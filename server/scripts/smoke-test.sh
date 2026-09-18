#!/usr/bin/env bash
# ClaimChain end-to-end smoke test:
# local Hardhat node -> deploy -> API boot -> claim lifecycle -> tamper demo -> restore.
# Everything runs inside this one shell so no background process needs to outlive it.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
BLOCKCHAIN="$ROOT/blockchain"
SERVER="$ROOT/server"
ACCOUNT0_KEY="0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" # node account #0 = contract owner

NODE_PID=""
API_PID=""
cleanup() {
  [ -n "$API_PID" ] && kill "$API_PID" 2>/dev/null || true
  [ -n "$NODE_PID" ] && kill "$NODE_PID" 2>/dev/null || true
  wait 2>/dev/null || true
}
trap cleanup EXIT

wait_for() { # url, label
  for _ in $(seq 1 40); do
    if curl -s -m 2 -o /dev/null "$1"; then return 0; fi
    sleep 1
  done
  echo "FAIL: $2 did not become ready" >&2
  return 1
}

echo "== 1. Starting Hardhat node =="
(cd "$BLOCKCHAIN" && npx hardhat node > /tmp/cc-node.log 2>&1) &
NODE_PID=$!
wait_for "http://127.0.0.1:8545" "Hardhat node"
echo "node ready (pid $NODE_PID)"

echo "== 2. Deploying ClaimAuditTrail =="
(cd "$BLOCKCHAIN" && npm run deploy:local > /tmp/cc-deploy.log 2>&1)
ADDRESS="$(node -e "console.log(require('$BLOCKCHAIN/deployments/localhost.json').address)")"
echo "deployed at $ADDRESS"

echo "== 3. Starting API server =="
# Inline env assignments win over the sandbox's exported PORT=0 (a .env file would
# NOT help: dotenv refuses to override already-set process env vars).
(cd "$SERVER" && PORT=4000 RPC_URL=http://127.0.0.1:8545 PRIVATE_KEY="$ACCOUNT0_KEY" CONTRACT_ADDRESS="$ADDRESS" npx tsx src/index.ts > /tmp/cc-api.log 2>&1) &
API_PID=$!
wait_for "http://localhost:4000/api/health" "API server"
echo "api ready (pid $API_PID)"

echo "== 4. Health check =="
curl -s http://localhost:4000/api/health
echo

echo "== 5. Creating claim (seals genesis record on-chain) =="
CLAIM_JSON="$(curl -s -X POST http://localhost:4000/api/claims \
  -H 'Content-Type: application/json' \
  -d '{"claimantName":"Ramesh Kumar","lossType":"flood","amountRequested":6500,"imageHashes":["photo1-hash","photo2-hash"]}')"
CLAIM_ID="$(node -e "console.log(JSON.parse(process.argv[1]).id)" "$CLAIM_JSON")"
echo "claim id: $CLAIM_ID (genesis sealed)"

echo "== 6. Sealing AI decision transition =="
curl -s -X POST "http://localhost:4000/api/claims/$CLAIM_ID/transitions" \
  -H 'Content-Type: application/json' \
  -d '{"status":"AI_APPROVED","note":"pHash unique, GPS valid, OCR confidence 99.2%"}' | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const j=JSON.parse(d);console.log('sealed:',j.sealed,'tx:',j.txHash)})"

echo "== 7. Sealing payout transition =="
curl -s -X POST "http://localhost:4000/api/claims/$CLAIM_ID/transitions" \
  -H 'Content-Type: application/json' \
  -d '{"status":"PAID","note":"UPI payout released to Aadhaar-linked account"}' | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const j=JSON.parse(d);console.log('sealed:',j.sealed,'tx:',j.txHash)})"

echo "== 8. Audit trail + integrity report (before tamper) =="
curl -s "http://localhost:4000/api/claims/$CLAIM_ID/audit-trail" | node -e "
  let d=''; process.stdin.on('data',c=>d+=c).on('end',()=>{
    const j = JSON.parse(d);
    console.log('recordCount:', j.recordCount, '| integrity:', JSON.stringify(j.integrity));
  });
"

echo "== 9. TAMPER DEMO: retro-edit record 1 (AI decision) =="
curl -s -X POST http://localhost:4000/api/demo/tamper \
  -H 'Content-Type: application/json' \
  -d "{\"claimId\":\"$CLAIM_ID\",\"recordIndex\":1,\"forgedLabel\":\"e2-FORGED-15000\"}" | node -e "
  let d=''; process.stdin.on('data',c=>d+=c).on('end',()=>{
    const j = JSON.parse(d);
    console.log('forged slot:', j.forged.slot);
    console.log('integrity:', JSON.stringify(j.integrity));
    console.log('verdict:', j.verdict);
  });
"

echo "== 10. RESTORE: undo the forgery =="
curl -s -X POST http://localhost:4000/api/demo/restore \
  -H 'Content-Type: application/json' \
  -d "{\"claimId\":\"$CLAIM_ID\",\"recordIndex\":1}" | node -e "
  let d=''; process.stdin.on('data',c=>d+=c).on('end',()=>{
    const j = JSON.parse(d);
    console.log('integrity:', JSON.stringify(j.integrity));
    console.log('verdict:', j.verdict);
  });
"

echo "== 11. Smoke test complete =="

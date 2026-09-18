#!/usr/bin/env bash
# ClaimChain one-command demo launcher (for judges / presentations).
# Runs: Hardhat node -> contract deploy -> API server -> web dashboard.
# Open http://localhost:5173 when everything is ready. Ctrl+C stops everything.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BLOCKCHAIN="$ROOT/blockchain"
SERVER="$ROOT/server"
WEB="$ROOT/web"
ACCOUNT0_KEY="0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" # local node account #0 = contract owner

PIDS=()
cleanup() {
  for pid in "${PIDS[@]:-}"; do kill "$pid" 2>/dev/null || true; done
  wait 2>/dev/null || true
}
trap cleanup EXIT INT TERM

wait_for() { # url label
  for _ in $(seq 1 45); do
    if curl -s -m 2 -o /dev/null "$1"; then return 0; fi
    sleep 1
  done
  echo "FAIL: $2 did not become ready" >&2
  return 1
}

echo "== [1/4] Starting local blockchain node =="
(cd "$BLOCKCHAIN" && npx hardhat node > /tmp/cc-demo-node.log 2>&1) &
PIDS+=($!)
wait_for "http://127.0.0.1:8545" "Hardhat node"
echo "   node ready"

echo "== [2/4] Deploying ClaimAuditTrail =="
(cd "$BLOCKCHAIN" && npm run deploy:local > /tmp/cc-demo-deploy.log 2>&1)
ADDRESS="$(node -e "console.log(require('$BLOCKCHAIN/deployments/localhost.json').address)")"
echo "   contract at $ADDRESS"

echo "== [3/4] Starting API server (port 4000) =="
(cd "$SERVER" && PORT=4000 RPC_URL=http://127.0.0.1:8545 PRIVATE_KEY="$ACCOUNT0_KEY" CONTRACT_ADDRESS="$ADDRESS" npx tsx src/index.ts > /tmp/cc-demo-api.log 2>&1) &
PIDS+=($!)
wait_for "http://localhost:4000/api/health" "API server"
echo "   api ready"

echo "== [4/4] Starting web dashboard (port 5173) =="
(cd "$WEB" && npx vite --port 5173 > /tmp/cc-demo-web.log 2>&1) &
PIDS+=($!)
wait_for "http://localhost:5173" "Web dashboard"

echo ""
echo "=============================================="
echo "  ClaimChain demo is LIVE"
echo "  Dashboard:  http://localhost:5173"
echo "  API:        http://localhost:4000/api/health"
echo ""
echo "  Demo flow for judges:"
echo "   1. Submit a claim  -> genesis record sealed on-chain"
echo "   2. AI Approve      -> decision sealed"
echo "   3. Pay via UPI     -> payout sealed"
echo "   4. Attempt Retro-Edit -> chain BREAKS (tamper proof!)"
echo "   5. Restore         -> chain valid again"
echo "=============================================="
echo ""
wait

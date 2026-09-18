# ClaimChain — Persistent Context & Conversation Log

> Single source of truth for project context and our working history.
> **Maintenance rule:** a dated entry is appended to the [Conversation Log](#conversation-log) at the end of every meaningful turn, so this file stays in sync with the conversation.

---

## 1. Project Snapshot

**ClaimChain** is an AI-assisted micro-insurance claims platform with a blockchain-backed immutable audit trail, aimed at Indian farmers and low-income policyholders (payouts typically ₹1,000–₹10,000).

**Core flow (from `ClaimChain_Description.md`):**
1. **Submit** — claimant uploads photos of damage/bills/ID from a basic smartphone; no forms.
2. **Verify** — Document AI extracts policy/bill data; computer vision assesses damage; perceptual-hash (pHash) database catches reused/altered images; cross-check against policy terms and past claims.
3. **Decide** — approve / flag / escalate to human in under a minute, with plain-language reasoning.
4. **Seal** — every event (submission, AI decision, human override, payout) is hashed and chained on-chain (Polygon L2 in mockups); retro-edits break the hash chain.
5. **Prove** — customers and regulators verify integrity via hashes without exposing PII.

**Current phase: DESIGN ONLY.**
- One commit (`UI/UX`, 2026-09-18), 17 tracked files.
- No application code, no backend, no smart contracts, no `package.json`, no build system.
- Deliverables so far: 1 product pitch doc, 1 design system doc, 5 static high-fidelity HTML screens + their PNG screenshots + logo/persona assets.

### Repository structure

```
├── ClaimChain_Description.md        # Product concept / pitch (1 page)
├── CLAIMCHAIN_CONTEXT.md            # This file
└── design/
    ├── DESIGN_SYSTEM.md             # Full design token spec (enterprise-focused)
    ├── screens/                     # 5 static HTML mockups (~3,000 lines total)
    │   ├── 01_simple_photo_claim_submission.html   (387 lines)
    │   ├── 02_farmer_portal_claim_status.html      (479 lines)
    │   ├── 03_claims_command_center.html           (806 lines)
    │   ├── 04_forensic_evidence_inspection.html    (592 lines)
    │   └── 05_audit_ledger_tamper_proofs.html      (702 lines)
    ├── screenshots/                 # PNG render of each screen
    └── assets/                      # 2 logos (SVG) + 2 persona portraits (PNG)
```

---

## 2. Design System Summary

A deliberate **dual-audience split**:

### Farmer-facing screens (01, 02)
- **Light theme**: `#f8f9ff` background, calming greens/blues (`primary: #006948`)
- **Font**: Plus Jakarta Sans
- Large touch targets (h-14 buttons), zero-paperwork language, audio guide, EN / हिन्दी / मराठी toggle, voice narration
- Built for low digital literacy; offline-first messaging ("Works offline • Syncs once connection returns")

### Enterprise forensic screens (03, 04, 05)
- **Dark obsidian canvas**: `#0A0F1D` base, `#11192E` cards, `#1E293B` borders
- **Fonts**: Inter (narrative UI) + JetBrains Mono (hashes, timestamps, policy math)
- Strict status-color semantics:
  - Cyan `#06B6D4` = AI engine output
  - Emerald `#10B981` = verified / immutable / valid
  - Amber `#F59E0B` = human review required
  - Red `#EF4444` = tamper / fraud alert
- Sharp 4px radii; pills prohibited except status chips; depth via tonal layering, not shadows
- Density-optimized 3-zone desktop layout (nav/telemetry + claims matrix + forensic dock)

**Known inconsistency:** the two audience groups ship **divergent Tailwind configs** (different palettes, radii scales — e.g. `full: 9999px` vs `0.75rem` — and font scales). `DESIGN_SYSTEM.md` only documents the enterprise side.

---

## 3. Screen Inventory

| # | Screen | Lines | Audience | Purpose | Interactivity |
|---|--------|-------|----------|---------|---------------|
| 01 | Simple Photo Claim Submission | 387 | Farmer | 3-step intake: loss type → geotagged photos → UPI payout | Loss-category card selection, audio-guide modal, submit/save-draft handlers |
| 02 | Farmer Portal Claim Status | 479 | Farmer | Claim tracking, weather-index alerts (42mm rain trigger), payout receipts | Voice narrator toggle |
| 03 | Claims Command Center | 806 | Insurer ops | KPI dashboard, live fraud alert (cross-district pHash anomaly: same imagery in Yavatmal vs Nanded), throughput telemetry | Forensic modal with open/close/backdrop/block-claim handlers |
| 04 | Forensic Evidence Inspection | 592 | Fraud analyst | Split-view image forensics, CV bounding boxes, SHA-256/pHash collision (Hamming distance 2 vs archive #CLM-4102), AI-override actions | Heatmap toggle, sync zoom, toast notifications, sign-reject / confirm-fraud / override / escalate handlers |
| 05 | Audit Ledger & Tamper Proofs | 702 | Regulator / auditor | Live Merkle block stream (Polygon L2), hash search, validator quorum incl. IRDAI node, zk-SNARK proof verification | **Interactive tamper simulation** (retro-edit ₹4,500→₹15,000 breaks hash chain visually), hash-verify drawer, event filter, copy-to-clipboard, validator-key modal, proof export |

**Shared narrative detail:** claim #CLM-8919 flagged in the command center (03) is the same claim under forensic inspection (04); #CLM-8920 is the farmer's paid claim (02). The screens tell one coherent end-to-end story.

**Technical makeup:** static self-contained HTML + Tailwind via CDN + vanilla JS script blocks; Material Symbols icons; Plus Jakarta Sans / Inter / JetBrains Mono via Google Fonts; **remote images hosted on googleusercontent.com (will break if links expire)**.

---

## 4. Gaps & Observations

1. **No inter-screen navigation** — `data-path` attributes exist but every link is `href="#"`; the 5 screens are not wired together.
2. **6 referenced screens don't exist yet**: Overview & Queue, Perceptual Hash Database, Policy Rules & Thresholds, Auditor Verification Portal, System Logs & Merkle Proofs, Weather Index / Cooperative (farmer side).
3. **Divergent Tailwind configs** between farmer and enterprise screens (see §2).
4. **Remote Google-hosted images** — mockups depend on external `lh3.googleusercontent.com` URLs.
5. **Not production-grade tech** — Tailwind CDN, no build system, no state, no data layer, no tests.
6. **Pitch ≠ implementation** — the blockchain, AI pipeline, and UPI rails described in the pitch have zero implementation so far.

---

## 5. Tech Stack (decided 2026-09-18)

Monorepo with three independent npm workspaces (no root workspace hoisting; each has its own lockfile):

| Workspace | Stack | Purpose |
|-----------|-------|---------|
| `web/` | React 19 SPA — Vite 8, TypeScript, Tailwind CSS v4, React Router 7, TanStack Query 5, Zustand 5, ethers v6, zod | Claimant + adjuster front-end, ported from the `design/screens` mockups |
| `server/` | Node + Express 5 (ESM), TypeScript (strict, NodeNext), tsx for dev, ethers v6, zod, cors | REST API for claims, AI-verification hooks, and on-chain sealing |
| `blockchain/` | Hardhat 3.17 + Solidity 0.8.20 (`ClaimAuditTrail.sol`, hardened), plugins: hardhat-ethers + hardhat-mocha; targets local node + Polygon Amoy (chainId 80002) | Immutable, **hash-chained** claim audit trail with owner-gated sealing and `verifyTrail` |

**Decisions:**
- **React SPA + Node API** (user choice) over Next.js — traditional split, two deployables.
- **No persistence yet** (user choice) — claims live in an in-memory store; Prisma/Postgres deferred to the backend phase.
- **npm** everywhere (matches pre-existing blockchain lockfile).
- Hardhat 3 gotchas handled: toolbox@7 is an empty stub (removed; real plugins installed individually), ESM `"type": "module"` required, networks need explicit `type` (`edr-simulated` / `http`).
- Vite dev server proxies `/api` → `http://localhost:4000` (Express).

**Verified:** `web` typecheck + production build pass; `server` typecheck passes; `blockchain` compiles (solc 0.8.20), **11/11 tests pass**, deploy script works.

**Run commands:** `cd web && npm run dev` (5173) · `cd server && npm run dev` (4000) · `cd blockchain && npm run node` / `compile` / `test` / `deploy:local` · **end-to-end demo: `bash server/scripts/smoke-test.sh`** (starts node → deploys → boots API → creates claim → seals AI decision + payout → prints verified audit trail; cleans up after itself) · **judge demo: `npm run demo` (root) — one command boots node + deploy + API + dashboard**.

### Presentation prototype (2026-09-18)
- **`web/` is now a live Command Center** (dark forensic theme from DESIGN_SYSTEM.md, Inter + JetBrains Mono): claim intake (loss type / amount / photo count), claims queue, per-claim action ribbon (AI Approve / AI Flag / Pay via UPI — each seals on-chain), Immutable Audit Trail timeline with per-record hash + prev-hash links, integrity strip (off-chain vs on-chain verdicts, live ledger stats), and the **Attempt Retro-Edit / Restore** tamper demo wired to `/api/demo/*`. TanStack Query polling keeps everything live; Vite proxies `/api` → 4000.
- Root `package.json` added with convenience scripts: `demo`, `smoke`, `web`, `server`, `chain:test`, `install:all`. Demo launcher: `scripts/demo.sh` (boot all services, print the 5-step judge flow, Ctrl+C teardown).
- **Verified end-to-end on the running stack:** claim created → transition sealed (HTTP 200) → trail returned 2 records with integrity valid → dashboard served (HTTP 200).

### Backend architecture (implemented 2026-09-18)
- **Contract** (`blockchain/contracts/ClaimAuditTrail.sol`): `onlyOwner` sealing (API signer = deployer), `bytes32` claim IDs (`keccak256(claimId)`), per-record `recordHash = keccak256(abi.encode(prev, stateHash, status, ts, by, noteHash))` chaining to the previous record, `latestRecordHash` chain head, `totalRecords` metric, `verifyTrail(claimId) → (valid, brokenAtIndex)` with `type(uint256).max` = intact, indexed `ClaimStateSealed` event.
- **Server chain layer** (`server/src/chain/`): `chain.ts` = TS mirror of the contract's hashing (`computeStateHash`, `computeRecordHash`, `findChainBreak`) — must stay byte-identical to the Solidity formula (tests enforce); `abi.ts` = minimal ABI; `client.ts` = provider + `NonceManager`-wrapped wallet (fixes stale-nonce errors on automining nodes), graceful degradation when the node is down (`enabled: false`).
- **API** (`server/src/index.ts`, port 4000): `POST /api/claims` (seals genesis record), `POST /api/claims/:id/transitions` (seals AI decision / override / payout), `GET /api/claims/:id/audit-trail` (reads back from chain, verifies hash chain on- AND off-chain, returns integrity report), `GET /api/health` (chain status + totalRecords), **`POST /api/demo/tamper`** (forgery demo, local nodes only) and **`POST /api/demo/restore`** (undo), **`GET /api/stats`** (KPIs: claims today, auto-approval %, flagged, ₹ leakage prevented, ₹ paid, records sealed), **`GET /api/claims/:id/merkle`** (Merkle root + per-record inclusion proofs, self-verified), **`POST /api/merkle/verify`** (auditor proof replay), **`GET /api/explorer/events`** (recent ClaimStateSealed events with tx hashes), **`GET /api/explorer/search?q=`** (search by CLM id or any 0x hash), **`GET /api/claims/:id/dossier`** (downloadable signed cryptographic dossier: canonical hash + EIP-191 signature + Merkle root). Claims live in memory (persistence deferred).
- **Demo seeds** (`server/src/seed.ts`): on boot, seals 3 mockup-matching claims if the contract is fresh — CLM-8919 (pHash-collision fraud, AI_FLAGGED), CLM-8920 (clean flood claim, PAID), CLM-8930 (fresh SUBMITTED). Idempotent via `getTrailLength === 0` check; disable with `SEED_DEMO=0`.
- **New chain modules**: `merkle.ts` (binary Merkle tree over recordHash leaves, duplicate-last promotion, proof gen/verify), `explore.ts` (eth_getLogs event scan + search interpreter), `dossier.ts` (canonical JSON → keccak256 → EIP-191 signed attestation).
- **Tamper demo** (`server/src/chain/tamper.ts`): locates the target record's stateHash storage slot via a stride-agnostic calibrated scan, rewrites it with `hardhat_setStorageAt` (guarded by `assertLocalRpc` — refuses any non-local RPC), then reports the verdict; restore rewrites the original value (kept in `restoreMemo`). This is design screen 05's "Attempt Retro-Edit" button, made real.
- **Sandbox gotcha:** the environment exports `PORT=0`; the API guards with `Number(PORT) > 0 ? … : 4000`.
- **No user action needed:** all libraries are already installed (web/server/blockchain each have node_modules + lockfiles). Anyone cloning fresh just runs `npm install` in each of the three folders. Nothing else to download — Hardhat's local node replaces Ganache, solc downloads itself on first compile.

---

## 6. Conversation Log

> Newest entries at the bottom. Each entry: date — what was requested, decided, and done.

### 2026-09-18 — Initial full-project analysis
- **Request:** "analayse this whole projects"
- **Done:** Explored repo (pitch doc, design system, 5 HTML screens, screenshots, assets). Produced full analysis: project concept, repo structure, per-screen inventory, technical stack of mockups, design-system split, gaps (unwired nav, 6 missing screens, divergent configs, remote images, no build system). Assessment: strong coherent design-phase repo; obvious next milestone is turning mockups into a working app.
- **Follow-ups offered:** build working app from mockups; add missing screens; unify design system; prototype hash-chain demo.

### 2026-09-18 — Persistent context file created
- **Request:** "first of all make a file and save our conversation and context simultaneously"
- **Decision:** single markdown file in project root — `CLAIMCHAIN_CONTEXT.md` — holding project context + running conversation log; plan approved in plan mode.
- **Done:** this file was created with the full snapshot above; ongoing rule: append a dated entry per meaningful turn.

### 2026-09-18 — Tech stack decided & libraries installed
- **Request:** "decide the tech stacks for this project and install required libaraies"
- **Decisions (user-confirmed):** React SPA + Node API (not Next.js); skip persistence for now; npm as package manager. Discovered a parallel `blockchain/` workspace (Hardhat + `ClaimAuditTrail.sol`) and built the stack around it.
- **Scaffolded:** `web/` (Vite react-ts + Tailwind v4, router/query/state/ethers/zod) and `server/` (Express 5 ESM + TS strict, health + in-memory claims endpoints with zod validation, Vite dev proxy on `/api`).
- **Fixed in `blockchain/`:** Hardhat 3 needs ESM (`type: module`, import/export config, explicit network `type`s); removed empty `hardhat-toolbox@7` stub.
- **Verified:** all three workspaces compile — web build ✓, server typecheck ✓, contract compile (solc 0.8.20) ✓.

### 2026-09-18 — UI/UX work deferred; backend-first direction chosen
- **Request:** user wants to **redesign the UI/UX later**, so frontend porting is paused; asked what to work on instead and whether the conversation is being saved.
- **Decision:** skip all `web/` frontend work for now. Next milestone candidates: (a) end-to-end claim-sealing backend flow (contract hardening + Hardhat tests + deploy scripts + server↔contract integration + tamper detection), (b) contract tests only, (c) pure-TS hash-chain/tamper-verification logic in the server.
- **Contract review note:** `ClaimAuditTrail.sol` is a solid skeleton but lacks access control (anyone can seal), uses `string` claimIds (gas-heavy; `bytes32` cheaper), and each `AuditRecord` is independent — the pitch's "chained hashes" (each hash embedding the previous) is not implemented yet, so retro-edit detection relies only on blockchain immutability, not on-chain chain-breaking.

### 2026-09-18 — Backend milestone: hardened contract + E2E claim sealing (autonomous)
- **Request:** "I'll leave it on you how to proceed… tell me how much you have proceeded and what you gonna do… tell me if I have to download any libraries."
- **Contract hardened** (all three review gaps fixed): owner-gated `sealClaimState` with custom errors, `bytes32` claim IDs, real **hash chaining** (`recordHash` embeds `prevRecordHash`), `verifyTrail` returning the break index, `totalRecords`, indexed event.
- **Test suite: 11/11 passing** (`blockchain/test/ClaimAuditTrail.test.ts`, Hardhat 3 `network.create()` API). Tamper test forges a historical record via `hardhat_setStorageAt` with a **calibrated storage scan** (compiler-specific 6-slot record stride found empirically) and proves `verifyTrail` flags the break at the exact index.
- **Hardhat 3 lessons:** JS test files must be `.ts` (TS syntax isn't parsed in `.js`); `hardhat-toolbox@7`/`hardhat-chai-matchers@3` are empty stubs — use `hardhat-ethers` + `hardhat-mocha` plugins; revert assertions via custom try/catch helper (`expectCustomError`); deploy script uses `connection.networkName` and writes `blockchain/deployments/<network>.json`.
- **Server↔chain integration:** new `server/src/chain/{chain,abi,client}.ts`; claim creation seals genesis record; `POST /api/claims/:id/transitions` seals AI/human/payout transitions; `GET /api/claims/:id/audit-trail` returns records + integrity report (on-chain AND off-chain verification). Fixed `PORT=0` sandbox env bug and stale-nonce failures via `ethers.NonceManager`.
- **End-to-end smoke test passes** (`bash server/scripts/smoke-test.sh`): node → deploy → API → create claim → seal AI_APPROVED → seal PAID → audit trail shows 3 chained records, integrity valid.
- **Libraries for the user: none** — everything installed. Fresh clones: `npm install` in `web/`, `server/`, `blockchain/`.

### 2026-09-18 — Backend logic completion round (user: "fuck frontend do backend and all the logic")
- **Added:** Merkle inclusion-proof service + endpoints, chain explorer (event feed + hash/claim search), signed dossier export, `/api/stats` KPIs, and idempotent demo seeds (CLM-8919/8920/8930) matching the design-mockup narrative.
- **Full-stack functional verification passed:** seeds loaded (3 claims, correct statuses) · stats computed (6 sealed records) · Merkle bundle for CLM-8920 (3 leaves, every proof self-verifies) · explorer returned 5 events · search "CLM-8920" → 3 matches · dossier signed (132-char sig) with matching Merkle root.
- **Frontend status:** shelved mid-build by user stop — Command Center + Farmer Portal pages written, Auditor page + router wiring NOT done (web will not compile until finished). Backend fully green.

### 2026-09-18 — Completion audit & context save (user: "does all the backend and the AI and Blockchain completed if yes save the context")
- **Blockchain: COMPLETE** — hardened hash-chained `ClaimAuditTrail.sol` (owner-gated, bytes32 ids, `verifyTrail`), 11/11 Hardhat tests incl. storage-level tamper detection, deploy scripts (local ✓ verified; Amoy ready but **blocked on user funding the testnet wallet** `0x28E6d16F698e3120811DDCFf9549bD02D4d6fc2f` from a faucet).
- **Backend/API: COMPLETE** — claim lifecycle sealing, dual integrity verification, tamper/restore demo, seeds, `/api/stats`, Merkle inclusion proofs, chain explorer + search, signed dossier export, graceful degradation, nonce protection. All verified live end-to-end.
- **AI: NOT IMPLEMENTED — by design.** No real OCR/computer-vision/pHash service exists. The "AI decisions" in the demo are **deterministic simulated logic**: seeded narratives (CLM-8919's pHash-collision flag is a scripted note), fixed acceptance notes, and (in the unfinished frontend) a staged animation. The architecture is ready for real AI (image hashes flow through `computeStateHash`; notes are free-form) but wiring a real model/OCR/pHash library was never in scope so far.
- **Honest summary for judges/stakeholders:** blockchain layer real & tested; API layer real & tested; AI layer is simulated/stubbed pending a real model (e.g. Tesseract OCR, pHash lib, or a vision API) — that is the single remaining substantive build item besides Amoy funding/deployment.

### 2026-09-18 — Frontend pivot for judge presentation (user request)
- **Request:** "stop for a minute and work on frontend now we have to present the basic prototype to judges."
- **Delivered:** live Command Center prototype in `web/` (design-token faithful, API-wired, incl. tamper demo UI) + `npm run demo` one-command launcher + root package.json scripts. Full stack verified working together (claim → seal → trail → dashboard 200).

### 2026-09-18 — Tamper-detection demo + deploy env templates (autonomous)
- **Added** `POST /api/demo/tamper` + `POST /api/demo/restore`: a real, safe reproduction of design screen 05's retro-edit simulation. Smoke test extended (steps 9–10): tampering → `TAMPERING DETECTED` (break at record index 1, caught on-chain AND off-chain) → restore → `CHAIN RESTORED`.
- **Safety**: demo endpoints refuse non-local RPCs (`assertLocalRpc` checks the hostname against 127.0.0.1/localhost/::1); only `hardhat_setStorageAt` on a sandbox node can forge storage.
- **Refactors**: `integrityReport()` helper (shared verdict shape; MaxUint256 sentinel surfaced as null), `loadTrail()` extracted, `ChainClient` now exposes `provider` + `rpcUrl`.
- **Added** `server/.env.example` and `blockchain/.env.example` — with local-node defaults and commented Amoy settings (faucet link included) so testnet deployment is config-only when a funded key is available.
- **Verified**: server typecheck ✓ · contract tests 11/11 ✓ · full smoke test incl. tamper/restore ✓.

### 2026-09-18 — Real workflow spec written (user: "don't change the code, define what the workflow should look like")
- **Request:** the demo buttons (AI Approve / AI Flag / Attempt Retro-Edit) feel fake: no document/photo upload, no actual AI verification, no visible result logs, and flagged claims can still be paid. User wants the *real* workflow defined first — **explicitly: no frontend changes, no code changes this round.**
- **Created `CLAIMCHAIN_WORKFLOW.md`** (source-of-truth spec, zero code touched):
  1. **Intake:** `POST /api/claims` becomes multipart — required photos (1–6) + optional bills/ID docs; server computes sha256 + pHash + EXIF per file, stores evidence rows, seals hashes in the genesis record; late evidence = sealed ADDENDUM records.
  2. **AI verification pipeline:** auto-runs after creation (no button). 7 deterministic stages (EXIF integrity → pHash duplicate detection → OCR extract → policy match → damage heuristics → fraud rules → threshold decision), each emitting a hash-linked log entry; verdicts `AI_APPROVED / AI_FLAGGED / AI_REJECTED` are **computed, never typed**. Rule-based verifier = "acts like AI" but is real deterministic code; ML swap later only replaces stage 5.
  3. **Result logs:** `GET /api/claims/:id/verification` returns the stage-by-stage log (timings, pass/fail, details); DECISION record commits the log's hashes on-chain.
  4. **State machine guard (the big fix):** server rejects client-chosen AI statuses; `PAID` returns 409 unless status is `AI_APPROVED`/`HUMAN_APPROVED` (**flag = payout freeze**); human override requires `AI_FLAGGED` + ≥20-char reason; new guarded `POST /api/claims/:id/pay`; new statuses `HUMAN_APPROVED / HUMAN_REJECTED / HUMAN_REVIEW` (enum decision deferred). **User re-confirmed the flag policy explicitly:** flagged = blocked until a human approves — this is RULE ZERO in the spec, no bypass; not "blocked forever", not "still payable".
  5. **Tamper rules:** evidence content-addressed (hash mismatch → `EVIDENCE_TAMPERED` auto-flag + freeze); verification history append-only (RETRY appends); retro-edit demo unchanged and local-node-only.
  - Includes endpoint-delta table + 7-step implementation order (guard first, upload, pipeline, wiring, sealing, OCR/CV, frontend last).
- **Decision kept:** frontend untouched per user instruction — UI changes (upload UI, pipeline stepper, review panel) explicitly deferred to the frontend rebuild round.

### 2026-09-18 — Free real-AI integration plan (user: "what things you will need to integrate a real AI in this system which will do all the work and completely free no cost")
- **Question answered — plan only, nothing installed or coded yet.** Zero-cost shopping list for replacing the simulated AI layer, mapped onto `CLAIMCHAIN_WORKFLOW.md`'s pluggable stages.
- **npm libraries (all open-source, free):** `sharp` (decode/normalize photos), `exifr` (real EXIF incl. GPS, timestamps, editing-software tags → stage 1), `sharp-phash` (real perceptual hashing + Hamming distance across all claims → stage 2), `tesseract.js` (in-process WASM OCR for bills/ID/policy numbers → stage 3; `eng`/`hin`/`mar` language packs auto-download), `@huggingface/transformers` (local CPU ONNX inference → stage 5 real computer vision).
- **Model weights (free, Hugging Face, ~300–500 MB disk, cached on first run):** CLIP ViT-B/32 ONNX — zero-shot damage labels ("flooded field", "cracked wall", "damaged vehicle") + image embeddings for near-duplicate detection beyond pHash. No GPU, no account, no card; a verification run costs seconds of CPU and works offline.
- **Plain-language decision reasoning (stage 7), three options:** (A, default) template-based generation from stage logs — deterministic, zero deps; (B) tiny local LLM via Ollama (`llama3.2:3b`, free, ~2 GB RAM); (C) free-tier cloud key (Groq / Gemini / OpenRouter — still ₹0 but needs a free account + one key in `server/.env`).
- **User action needed: none** for the local stack (just `npm install` + automatic model caching); option C is the only path requiring a free API key.
- **Build target when we say go:** `server/src/ai/` — one engine per spec stage (EXIF → pHash → OCR → policy match → damage → fraud rules → decision), multipart photo upload wired into claim creation, async job runner, `GET /api/claims/:id/verification` stage logs, computed verdicts sealed on-chain. ML swap later touches only stage 5, per the spec.
- **Honest caveat (stated to user):** Tesseract on low-quality smartphone photos is decent, not magic — per-field confidence scores (already in the spec's log format) + human review on flags is the correct behavior for this domain.
- **User then asked to save the whole chat** → this entry.

---

## 7. Next Steps / Open Threads

- [x] ~~**Wire `server/` claims API to the blockchain contract**~~ — **done**: sealing + verified audit-trail endpoint, e2e smoke test passes
- [ ] Add Prisma + SQLite/Postgres when persistence is needed (claims currently in-memory; sealing flow is store-agnostic)
- [ ] Deploy to Polygon Amoy testnet (`cd blockchain && npm run deploy:amoy` + funded key in `.env`)
- [x] ~~Tamper-detection demo endpoint~~ — **done**: `/api/demo/tamper` + `/api/demo/restore`, covered by the smoke test
- [ ] Deploy to Polygon Amoy testnet (`cd blockchain && npm run deploy:amoy` + funded key in `.env` per `blockchain/.env.example`)
- [ ] Port mockups into `web/` **once the UI/UX redesign is decided** (deferred by user)
- [ ] **Design the 6 missing screens** referenced in navs
- [ ] **Unify farmer + enterprise Tailwind configs** into one shared theme; document both in `DESIGN_SYSTEM.md`
- [ ] **Prototype the hash-chain demo** — hash claim events, chain them, detect historical edits (mirrors screen 05's tamper simulation with real crypto)
- [ ] **Implement `CLAIMCHAIN_WORKFLOW.md`** (2026-09-18 spec, user-approved direction, not yet coded): server transition guard + flag-lock on payout → multipart evidence upload → deterministic 7-stage verification pipeline with logs → auto-AI verdicts; frontend rebuild comes after
- [ ] **Integrate real AI (free local stack, plan approved 2026-09-18)**: `sharp` + `exifr` + `sharp-phash` + `tesseract.js` + `@huggingface/transformers` (CLIP ViT-B/32 ONNX, local CPU) — one engine per pipeline stage in `server/src/ai/`, ~300–500 MB model cache, no API keys needed; optional free-tier cloud LLM (Groq/Gemini) only for stage-7 reasoning via config flag
- [ ] Replace remote Google-hosted images with local assets in `design/assets/`
- [ ] Longer-term: implement actual claim pipeline (AI verification + on-chain sealing) described in the pitch; add Prisma + Postgres when persistence is needed

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { z } from 'zod';
import { ethers } from 'ethers';
import { randomUUID } from 'node:crypto';
import {
  CLAIM_STATUS,
  claimIdToBytes32,
  computeStateHash,
  findChainBreak,
  integrityReport,
  type ClaimStatusName,
  type TrailRecord,
} from './chain/chain.js';
import { createChainClient, type ChainClient } from './chain/client.js';
import { assertLocalRpc, findStateHashSlot, readSlot, writeSlot } from './chain/tamper.js';
import { buildClaimMerkleBundle, merkleRoot, verifyMerkleProof } from './chain/merkle.js';
import { fetchRecentEvents, searchChain } from './chain/explore.js';
import { buildDossier } from './chain/dossier.js';
import { seedClaims } from './seed.js';
import type { Claim } from './types.js';

const app = express();
app.use(cors({ origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173' }));
app.use(express.json({ limit: '10mb' }));

// Guard against sandbox environments exporting PORT=0 (treat 0/empty as unset).
const PORT = Number(process.env.PORT) > 0 ? Number(process.env.PORT) : 4000;

// ---------------------------------------------------------------------------
// Domain model (in-memory placeholder store — persistence deliberately deferred)
// ---------------------------------------------------------------------------
const claims = new Map<string, Claim>();

const CreateClaimInput = z.object({
  claimantName: z.string().min(1).max(120),
  lossType: z.enum(['flood', 'drought', 'livestock']),
  amountRequested: z.number().int().positive().max(100_000),
  imageHashes: z.array(z.string().min(1)).max(6).default([]),
});

const TransitionInput = z.object({
  status: z.enum(['AI_APPROVED', 'AI_FLAGGED', 'HUMAN_OVERRIDDEN', 'PAID', 'REJECTED']),
  note: z.string().min(1).max(280),
});

// ---------------------------------------------------------------------------
// Chain client (optional at boot — API degrades gracefully when node is down)
// ---------------------------------------------------------------------------
let chain: ChainClient;

// ---------------------------------------------------------------------------
// Health & meta
// ---------------------------------------------------------------------------
app.get('/api/health', async (_req, res) => {
  let totalRecords: string | null = null;
  if (chain.enabled) {
    try {
      totalRecords = (await chain.contract.totalRecords()).toString();
    } catch {
      /* node flapped; report null */
    }
  }
  res.json({
    ok: true,
    service: 'claimchain-api',
    version: '0.3.0',
    chain: { enabled: chain.enabled, contract: chain.address, totalRecords },
  });
});

// ---------------------------------------------------------------------------
// Stats (KPI strip)
// ---------------------------------------------------------------------------
app.get('/api/stats', async (_req, res) => {
  const all = Array.from(claims.values());
  const today = all.filter((c) => Date.now() - new Date(c.submittedAt).getTime() < 24 * 3600_000).length;
  const decided = all.filter((c) =>
    ['AI_APPROVED', 'AI_FLAGGED', 'HUMAN_OVERRIDDEN', 'PAID', 'REJECTED'].includes(c.status)
  );
  const autoApproved = all.filter((c) => c.status === 'AI_APPROVED' || c.status === 'PAID').length;
  const flagged = all.filter((c) => c.status === 'AI_FLAGGED' || c.status === 'HUMAN_OVERRIDDEN').length;
  const leakagePrevented = all
    .filter((c) => c.status === 'AI_FLAGGED' || c.status === 'REJECTED')
    .reduce((sum, c) => sum + c.amountRequested, 0);
  const paid = all.filter((c) => c.status === 'PAID').reduce((sum, c) => sum + c.amountRequested, 0);

  let totalRecords: number | null = null;
  if (chain.enabled) {
    try {
      totalRecords = Number(await chain.contract.totalRecords());
    } catch {
      /* ignore */
    }
  }

  res.json({
    claimsToday: today,
    total: all.length,
    autoApproved,
    autoApprovalPct: decided.length ? Math.round((autoApproved / decided.length) * 100) : null,
    flagged,
    leakagePreventedInr: leakagePrevented,
    paidInr: paid,
    totalRecords,
    chainEnabled: chain.enabled,
  });
});

// ---------------------------------------------------------------------------
// Claims
// ---------------------------------------------------------------------------
app.post('/api/claims', async (req, res) => {
  const parsed = CreateClaimInput.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid claim payload', details: parsed.error.issues });
  }

  const now = new Date().toISOString();
  const claim: Claim = {
    id: `CLM-${randomUUID().slice(0, 8).toUpperCase()}`,
    ...parsed.data,
    status: 'SUBMITTED',
    submittedAt: now,
  };

  // Seal the genesis transition on-chain.
  if (chain.enabled && chain.signerAddress) {
    try {
      const stateHash = computeStateHash({
        claimId: claim.id,
        lossType: claim.lossType,
        claimantName: claim.claimantName,
        amountRequested: claim.amountRequested,
        imageHashes: claim.imageHashes,
        sealedAt: now,
      });
      const tx = await chain.contract.sealClaimState(
        claimIdToBytes32(claim.id),
        stateHash,
        CLAIM_STATUS.SUBMITTED,
        'Claim submitted with photo evidence + geotag'
      );
      await tx.wait();
      claim.latestStateHash = stateHash;
    } catch (err) {
      console.error('[chain] genesis seal failed:', (err as Error).message);
      return res.status(503).json({ error: 'Chain unavailable: could not seal genesis record' });
    }
  }

  claims.set(claim.id, claim);
  return res.status(201).json(claim);
});

app.get('/api/claims', (_req, res) => {
  res.json(Array.from(claims.values()));
});

app.get('/api/claims/:id', (req, res) => {
  const claim = claims.get(req.params.id);
  if (!claim) return res.status(404).json({ error: 'Claim not found' });
  res.json(claim);
});

/**
 * Seal a subsequent state transition (AI decision, human override, payout).
 */
app.post('/api/claims/:id/transitions', async (req, res) => {
  const claim = claims.get(req.params.id);
  if (!claim) return res.status(404).json({ error: 'Claim not found' });

  const parsed = TransitionInput.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid transition payload', details: parsed.error.issues });
  }

  if (!chain.enabled || !chain.signerAddress) {
    return res.status(503).json({ error: 'Chain unavailable: sealing requires a connected node and PRIVATE_KEY' });
  }

  try {
    const sealedAt = new Date().toISOString();
    const stateHash = computeStateHash({
      claimId: claim.id,
      lossType: claim.lossType,
      claimantName: claim.claimantName,
      amountRequested: claim.amountRequested,
      imageHashes: claim.imageHashes,
      sealedAt,
    });

    const tx = await chain.contract.sealClaimState(
      claimIdToBytes32(claim.id),
      stateHash,
      CLAIM_STATUS[parsed.data.status],
      parsed.data.note
    );
    await tx.wait();

    claim.status = parsed.data.status;
    claim.latestStateHash = stateHash;
    return res.json({ claim, sealed: true, txHash: tx.hash });
  } catch (err) {
    console.error('[chain] transition seal failed:', (err as Error).message);
    return res.status(503).json({ error: 'Chain unavailable: could not seal transition' });
  }
});

/**
 * Immutable audit trail for a claim, read back from the chain and verified
 * off-chain (the "Prove" step). Includes an integrity report.
 */
app.get('/api/claims/:id/audit-trail', async (req, res) => {
  if (!chain.enabled) return res.status(503).json({ error: 'Chain unavailable' });

  try {
    const raw = (await chain.contract.getAuditTrail(claimIdToBytes32(req.params.id))) as Array<
      Record<string, unknown>
    >;

    const trail: TrailRecord[] = raw.map((r) => ({
      stateHash: String(r.stateHash),
      prevRecordHash: String(r.prevRecordHash),
      recordHash: String(r.recordHash),
      status: Number(r.status),
      timestamp: BigInt(r.timestamp as string | bigint),
      recordedBy: String(r.recordedBy),
      note: String(r.note),
    }));

    const breakAtIndex = findChainBreak(trail);
    const [onChainValid, onChainBrokenAt] = await chain.contract.verifyTrail(claimIdToBytes32(req.params.id));

    return res.json({
      claimId: req.params.id,
      recordCount: trail.length,
      integrity: integrityReport(breakAtIndex, onChainValid, onChainBrokenAt),
      records: trail.map((r) => ({
        ...r,
        timestamp: r.timestamp.toString(),
        sealedAtIso: new Date(Number(r.timestamp) * 1000).toISOString(),
      })),
    });
  } catch (err) {
    console.error('[chain] audit trail read failed:', (err as Error).message);
    return res.status(502).json({ error: 'Failed to read audit trail from chain' });
  }
});

// ---------------------------------------------------------------------------
// Merkle inclusion proofs (auditor "prove record #i is sealed" without trust)
// ---------------------------------------------------------------------------
app.get('/api/claims/:id/merkle', async (req, res) => {
  if (!chain.enabled) return res.status(503).json({ error: 'Chain unavailable' });
  try {
    const trail = await loadTrail(req.params.id);
    if (!trail || trail.length === 0) return res.status(404).json({ error: 'Claim not found on chain' });
    const bundle = buildClaimMerkleBundle(req.params.id, trail);
    return res.json({
      claimId: req.params.id,
      leaves: bundle.leaves,
      root: bundle.root,
      proofs: bundle.proofs.map((p) => ({
        leafIndex: p.leafIndex,
        leaf: p.leaf,
        root: p.root,
        siblings: p.siblings,
        /** Server-side self-check so the demo never ships a broken proof. */
        verifies: verifyMerkleProof(p),
      })),
    });
  } catch (err) {
    console.error('[merkle] bundle failed:', (err as Error).message);
    return res.status(500).json({ error: 'Failed to build Merkle bundle' });
  }
});

/** Verify an arbitrary leaf/root pair (auditor replay). */
app.post('/api/merkle/verify', (req, res) => {
  const Schema = z.object({
    leaf: z.string().startsWith('0x'),
    siblings: z.array(z.object({ hash: z.string().startsWith('0x'), isRight: z.boolean() })),
    root: z.string().startsWith('0x'),
  });
  const parsed = Schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid proof payload', details: parsed.error.issues });
  }
  const valid = verifyMerkleProof({
    leafIndex: 0,
    leaf: parsed.data.leaf,
    siblings: parsed.data.siblings,
    root: parsed.data.root,
  });
  return res.json({ valid, root: parsed.data.root });
});

// ---------------------------------------------------------------------------
// Chain explorer: recent sealed events + hash/claim search
// ---------------------------------------------------------------------------
app.get('/api/explorer/events', async (req, res) => {
  if (!chain.enabled) return res.status(503).json({ error: 'Chain unavailable' });
  try {
    const limit = req.query.limit ? Math.min(Number(req.query.limit) || 25, 100) : 25;
    const events = await fetchRecentEvents(chain.provider, chain.address, { limit });
    // Resolve CLM- display ids where possible.
    for (const c of claims.keys()) {
      const id32 = claimIdToBytes32(c).toLowerCase();
      for (const e of events) if (e.claimId.toLowerCase() === id32) e.claimIdRef = c;
    }
    return res.json({ count: events.length, events });
  } catch (err) {
    console.error('[explorer] events failed:', (err as Error).message);
    return res.status(502).json({ error: 'Failed to read events from chain' });
  }
});

app.get('/api/explorer/search', async (req, res) => {
  if (!chain.enabled) return res.status(503).json({ error: 'Chain unavailable' });
  const q = String(req.query.q ?? '').trim();
  if (!q) return res.status(400).json({ error: 'Missing query ?q=' });
  try {
    const { matches, interpretedAs } = await searchChain(chain.provider, chain.address, q);
    for (const m of matches) {
      const ref = Array.from(claims.keys()).find((c) => claimIdToBytes32(c).toLowerCase() === m.claimId.toLowerCase());
      if (ref) m.claimIdRef = ref;
    }
    return res.json({ query: q, interpretedAs, count: matches.length, matches });
  } catch (err) {
    console.error('[explorer] search failed:', (err as Error).message);
    return res.status(502).json({ error: 'Search failed' });
  }
});

// ---------------------------------------------------------------------------
// Cryptographic dossier export (regulator-grade, signed)
// ---------------------------------------------------------------------------
app.get('/api/claims/:id/dossier', async (req, res) => {
  if (!chain.enabled) return res.status(503).json({ error: 'Chain unavailable' });
  try {
    const trail = await loadTrail(req.params.id);
    if (!trail || trail.length === 0) return res.status(404).json({ error: 'Claim not found on chain' });
    const offBreak = findChainBreak(trail);
    const [onValid, onBrokenAt] = await chain.contract.verifyTrail(claimIdToBytes32(req.params.id));

    if (!chain.signerAddress) return res.status(503).json({ error: 'Dossier signing requires PRIVATE_KEY' });
    const signerWallet = (chain.contract.runner as ethers.ContractRunner & { signMessage?: never }) && null; // placeholder, replaced below
    void signerWallet;

    // Rebuild a signer directly from the client's provider for message signing.
    const { ethers: _e } = await import('ethers');
    const wallet = new _e.NonceManager(new _e.Wallet(process.env.PRIVATE_KEY as string, chain.provider));

    const dossier = await buildDossier(req.params.id, trail, integrityReport(offBreak, onValid, onBrokenAt), {
      address: chain.signerAddress,
      signMessage: (m: string | Uint8Array) => wallet.signMessage(m),
    });

    res.setHeader('Content-Disposition', `attachment; filename="${req.params.id}-dossier.json"`);
    return res.json(dossier);
  } catch (err) {
    console.error('[dossier] export failed:', (err as Error).message);
    return res.status(500).json({ error: 'Failed to build dossier' });
  }
});

// ---------------------------------------------------------------------------
// Tamper-detection demo (the "break the chain" proof from design screen 05)
// ---------------------------------------------------------------------------

/** Remembers the original stateHash per claim so /api/demo/restore can undo a tamper. */
const restoreMemo = new Map<string, string>();

/** Fetch + normalize a claim's on-chain trail. */
async function loadTrail(claimId: string): Promise<TrailRecord[] | null> {
  const raw = (await chain.contract.getAuditTrail(claimIdToBytes32(claimId))) as Array<
    Record<string, unknown>
  >;
  return raw.map((r) => ({
    stateHash: String(r.stateHash),
    prevRecordHash: String(r.prevRecordHash),
    recordHash: String(r.recordHash),
    status: Number(r.status),
    timestamp: BigInt(r.timestamp as string | bigint),
    recordedBy: String(r.recordedBy),
    note: String(r.note),
  }));
}

const TamperInput = z.object({
  claimId: z.string().min(1),
  recordIndex: z.number().int().min(1).default(1), // genesis (0) stays immutable in the demo
  /** Free-form forged state label; becomes the forged stateHash preimage. */
  forgedLabel: z.string().min(1).max(80).default('e2-FORGED-15000'),
});

/**
 * Demo: retro-edit a historical record's stored stateHash directly in node
 * storage — exactly what a malicious insider could do to a classic database —
 * then report the integrity verdict. LOCAL NODES ONLY (hardhat_setStorageAt).
 * Non-destructive: /api/demo/restore reverses the edit.
 */
app.post('/api/demo/tamper', async (req, res) => {
  if (!chain.enabled) return res.status(503).json({ error: 'Chain unavailable' });
  try {
    assertLocalRpc(chain.rpcUrl);
  } catch (err) {
    return res.status(403).json({ error: (err as Error).message });
  }

  const parsed = TamperInput.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid tamper payload', details: parsed.error.issues });
  }
  const { claimId, recordIndex, forgedLabel } = parsed.data;
  const id32 = claimIdToBytes32(claimId);

  try {
    const trail = await loadTrail(claimId);
    if (!trail || trail.length === 0) return res.status(404).json({ error: 'Claim not found on chain' });
    if (recordIndex >= trail.length) {
      return res.status(400).json({ error: `recordIndex ${recordIndex} out of range (0..${trail.length - 1})` });
    }

    const target = trail[recordIndex];
    const forgedStateHash = ethers.solidityPackedKeccak256(['string', 'bytes32'], [forgedLabel, id32]);

    // Locate the stored stateHash slot for the target record.
    const slot = await findStateHashSlot(chain.provider, chain.address, id32, recordIndex, target.stateHash);
    if (slot === null) {
      return res.status(500).json({ error: 'Could not locate stateHash slot for the target record' });
    }
    const originalStateHash = await readSlot(chain.provider, chain.address, slot);
    await writeSlot(chain.provider, chain.address, slot, forgedStateHash);
    restoreMemo.set(claimId, originalStateHash);

    // Verdict after the forgery.
    const trailAfter = (await loadTrail(claimId)) ?? [];
    const offBreak = findChainBreak(trailAfter);
    const [onValid, onBrokenAt] = await chain.contract.verifyTrail(id32);

    return res.json({
      demo: 'tamper',
      claimId,
      forged: {
        recordIndex,
        slot: '0x' + slot.toString(16),
        originalStateHash,
        forgedStateHash,
        forgedLabel,
      },
      integrity: integrityReport(offBreak, onValid, onBrokenAt),
      verdict:
        offBreak !== null || !onValid
          ? `TAMPERING DETECTED: hash chain broken at record index ${offBreak ?? 'on-chain'} — the forged payout no longer matches its sealed commitment.`
          : 'UNDETECTED (this would be a critical vulnerability!)',
    });
  } catch (err) {
    console.error('[demo] tamper failed:', (err as Error).message);
    return res.status(500).json({ error: 'Tamper simulation failed' });
  }
});

/**
 * Demo: undo a previous /api/demo/tamper by rewriting the original stateHash.
 * Only works while the forged value is still in the target slot.
 */
app.post('/api/demo/restore', async (req, res) => {
  if (!chain.enabled) return res.status(503).json({ error: 'Chain unavailable' });
  try {
    assertLocalRpc(chain.rpcUrl);
  } catch (err) {
    return res.status(403).json({ error: (err as Error).message });
  }

  const parsed = TamperInput.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid restore payload', details: parsed.error.issues });
  }
  const { claimId, recordIndex } = parsed.data;
  const id32 = claimIdToBytes32(claimId);

  try {
    const trail = await loadTrail(claimId);
    if (!trail || trail.length === 0) return res.status(404).json({ error: 'Claim not found on chain' });
    if (recordIndex >= trail.length) {
      return res.status(400).json({ error: `recordIndex ${recordIndex} out of range (0..${trail.length - 1})` });
    }

    const target = trail[recordIndex];
    const slot = await findStateHashSlot(chain.provider, chain.address, id32, recordIndex, target.stateHash);
    if (slot === null) {
      return res
        .status(404)
        .json({ error: 'Target record does not look forged (its stored stateHash cannot be located)' });
    }

    const originalStateHash = restoreMemo.get(claimId);
    if (!originalStateHash) {
      return res.status(409).json({
        error: 'No in-memory record of the original stateHash (server restarted?). Re-seed the demo claim instead.',
      });
    }

    await writeSlot(chain.provider, chain.address, slot, originalStateHash);
    restoreMemo.delete(claimId);

    const trailAfter = (await loadTrail(claimId)) ?? [];
    const offBreak = findChainBreak(trailAfter);
    const [onValid, onBrokenAt] = await chain.contract.verifyTrail(id32);

    return res.json({
      demo: 'restore',
      claimId,
      restored: { recordIndex, stateHash: originalStateHash },
      integrity: integrityReport(offBreak, onValid, onBrokenAt),
      verdict: onValid && offBreak === null ? 'CHAIN RESTORED: all records verify again.' : 'Restore incomplete.',
    });
  } catch (err) {
    console.error('[demo] restore failed:', (err as Error).message);
    return res.status(500).json({ error: 'Restore simulation failed' });
  }
});

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
async function main() {
  chain = await createChainClient();

  if (process.env.SEED_DEMO !== '0') {
    await seedClaims(chain, (c) => claims.set(c.id, c));
  }

  app.listen(PORT, () => {
    console.log(`ClaimChain API listening on http://localhost:${PORT} (chain ${chain.enabled ? 'enabled' : 'disabled'})`);
  });
}

void main();

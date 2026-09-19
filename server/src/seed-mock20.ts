import { CLAIM_STATUS, claimIdToBytes32, computeStateHash, type ClaimStatusName } from './chain/chain.js';
import type { ChainClient } from './chain/client.js';
import { runVerification, verificationHash } from './ai/pipeline.js';
import { generateEvidenceJpeg } from './ai/imagegen.js';
import { buildEvidenceRow } from './evidence.js';
import { claims } from './store.js';
import { registerDocument } from './ai/doc-registry.js';
import { MOCK_CLIENTS, REUSE_PAIR, type MockClient } from './mock-clients.js';
import type { Claim } from './types.js';

/**
 * 20-claim mock dataset seeder — replaces the old 4-claim demo.
 *
 * Every mock client gets their OWN registry + Aadhaar + bill images (20
 * distinct document sets), so the doc-reuse registry is quiet unless the
 * deliberate REUSE_PAIR demo fires. Clean claims flow through the REAL
 * pipeline to AI_APPROVED, then a human approval + UPI payout are replayed
 * (each sealed with an officer attestation in the note) so the
 * approved-claims interface shows complete, honest lifecycle data.
 */

interface ImgSpec {
  kind: 'photo' | 'bill' | 'registry' | 'aadhaar';
  keyword: string;
  variant: number;
  seedKey?: string;
}

function imagesFor(c: MockClient, lossKeyword: string): ImgSpec[] {
  const base: ImgSpec[] = [
    { kind: 'photo', keyword: lossKeyword, variant: 0, seedKey: `${c.id}-P0` },
    { kind: 'photo', keyword: lossKeyword, variant: 1, seedKey: `${c.id}-P1` },
    // Distinct registry + Aadhaar per client — deterministic bytes keyed by
    // client id. Real doc kinds so DOC_CROSS genuinely cross-verifies names.
    { kind: 'registry', keyword: `REGISTRY ${c.district.toUpperCase()} ${c.village.toUpperCase().split(' ')[0]} OWNER ${c.claimantName.toUpperCase()} DEED 7/12`, variant: 0, seedKey: `${c.id}-REG` },
    { kind: 'aadhaar', keyword: `AADHAAR ${c.claimantName.toUpperCase()} ${c.aadhaarMasked.replace('XXXX XXXX ', '#### ')} UIDAI`, variant: 0, seedKey: `${c.id}-AAD` },
    { kind: 'bill', keyword: `policy ${c.policyNumber} insured ${c.claimantName} ${c.district} claim amount ${c.amountRequested}`, variant: 0, seedKey: `${c.id}-BILL` },
  ];
  return base;
}

const LOSS_KEYWORD: Record<Claim['lossType'], string> = {
  flood: 'flooded field with standing water damage',
  drought: 'drought cracked dry parched field',
  livestock: 'injured livestock cattle in distress',
};

async function buildMockClaim(c: MockClient, minutesAgo: number): Promise<Claim> {
  const claim: Claim = {
    id: c.id,
    claimantName: c.claimantName,
    lossType: c.lossType,
    amountRequested: c.amountRequested,
    status: 'SUBMITTED',
    submittedAt: new Date(Date.now() - minutesAgo * 60_000).toISOString(),
    imageHashes: [],
    evidence: [],
    policyNumber: c.policyNumber,
    // Client contact details for the approved-claims interface:
    phone: c.phone,
    district: c.district,
    village: c.village,
    aadhaarMasked: c.aadhaarMasked,
  };

  for (const img of imagesFor(c, LOSS_KEYWORD[c.lossType])) {
    const buf = await generateEvidenceJpeg({
      claimId: c.id,
      kind: img.kind,
      variant: img.variant,
      keyword: img.keyword,
      seedKey: img.seedKey,
    });
    const row = await buildEvidenceRow(buf, img.kind, `${c.id}-${img.kind}-${img.variant}.jpg`, 'image/jpeg', {
      pHash: img.kind === 'photo',
      exif: false,
    });
    claim.evidence.push(row.evidence);
    claim.imageHashes.push(row.evidence.sha256);
  }
  return claim;
}

/** Register mock docs in the doc-registry (post-OCR aadhaar backfill handled by pipeline). */
function registerMockDocs(claim: Claim): void {
  for (const ev of claim.evidence) {
    if (ev.kind === 'photo' || ev.kind === 'satellite') continue;
    registerDocument(claim, ev, null);
  }
}

function describe(run: Awaited<ReturnType<typeof runVerification>>): string {
  const fails = run.stages.filter((x) => x.result === 'FAIL').map((x) => x.stage);
  return fails.length > 0 ? `fails: ${fails.join(', ')}` : 'all stages pass';
}

async function seal(
  chain: ChainClient,
  claimId: string,
  sealedAt: string,
  claim: Claim,
  rec: { status: ClaimStatusName; note: string },
  verHash?: string,
): Promise<void> {
  const stateHash = computeStateHash({
    claimId,
    lossType: claim.lossType,
    claimantName: claim.claimantName,
    amountRequested: claim.amountRequested,
    evidenceHashes: claim.imageHashes,
    pHashes: claim.evidence.filter((e) => e.pHash).map((e) => e.pHash as string),
    verificationHash: verHash,
    sealedAt,
  });
  const tx = await chain.contract.sealClaimState(claimIdToBytes32(claimId), stateHash, CLAIM_STATUS[rec.status], rec.note);
  await tx.wait();
  claim.latestStateHash = stateHash;
}

const OFFICER = 'Insp. S. Deshmukh (MH-OPS-011)';

/**
 * Seed the 20 mock clients. Chain path seals every lifecycle record;
 * chain-less path (train) still registers + verifies for the trainer.
 */
export async function seedMock20(chain: ChainClient): Promise<void> {
  const chainOk = chain.enabled && !!chain.signerAddress;
  let approved = 0;
  let flagged = 0;

  for (let i = 0; i < MOCK_CLIENTS.length; i++) {
    const c = MOCK_CLIENTS[i];
    if (claims.has(c.id)) continue; // restored from snapshot — never rebuild

    const minutesAgo = 60 * (24 + i * 3); // spread over ~3 days
    const claim = await buildMockClaim(c, minutesAgo);
    claims.set(claim.id, claim);
    registerMockDocs(claim);

    // Deliberate doc-reuse demo: the reuser files the ORIGINAL client's registry bytes.
    if (c.id === REUSE_PAIR.reuser) {
      const orig = MOCK_CLIENTS.find((x) => x.id === REUSE_PAIR.original);
      if (orig) {
        const buf = await generateEvidenceJpeg({
          claimId: orig.id,
          kind: 'registry',
          variant: 0,
          keyword: `REGISTRY ${orig.district.toUpperCase()} ${orig.village.toUpperCase().split(' ')[0]} OWNER ${orig.claimantName.toUpperCase()} DEED 7/12`,
          seedKey: `${orig.id}-REG`,
        });
        const row = await buildEvidenceRow(buf, 'registry', `${c.id}-registry-reused.jpg`, 'image/jpeg', { pHash: false, exif: false });
        claim.evidence.push(row.evidence);
        claim.imageHashes.push(row.evidence.sha256);
      }
    }

    const id32 = claimIdToBytes32(c.id);

    if (chainOk) {
      let trailLen = 0;
      try {
        trailLen = Number(await chain.contract.getTrailLength(id32));
      } catch (err) {
        console.warn('[mock20] chain unreachable mid-seed:', (err as Error).message);
        return;
      }
      if (trailLen > 0) continue; // already sealed on a previous boot
      await seal(chain, c.id, claim.submittedAt, claim, {
        status: 'SUBMITTED',
        note: `Claim submitted · ${claim.evidence.length} evidence file(s) · ${c.district}/${c.village.split(' ')[0]} · contact on file`,
      });
    }

    // --- REAL pipeline verdict ---------------------------------------------
    const run = await runVerification(claim, claims);
    claim.verification = run;

    const decisionAt = new Date(Date.now() - (minutesAgo - 20) * 60_000).toISOString();
    if (chainOk) {
      await seal(
        chain,
        c.id,
        decisionAt,
        claim,
        { status: run.verdict, note: `AI ${run.verdict} · score ${run.score} · ${describe(run)}` },
        verificationHash(run),
      );
    }
    claim.status = run.verdict;

    // --- Aftermath policy (honest mix for the approved-claims register) -----
    //  AI_APPROVED               → paid (auto path, attested disbursement)
    //  flagged/rejected + clean  → human review resolves it (attested approval) → paid
    //  fraud narrative (!clean)  → stays HELD at the pipeline verdict (no pay)
    const isFraudNarrative = !c.clean;
    if (run.verdict === 'AI_APPROVED') {
      const payAt = new Date(Date.now() - (minutesAgo - 55) * 60_000).toISOString();
      const payNote = `UPI payout ₹${claim.amountRequested} · ref UPI-${c.id.slice(-6)}-${1000 + i} · [ATTESTED by ${OFFICER}] I accept full responsibility for this decision`;
      if (chainOk) {
        await seal(chain, c.id, payAt, claim, { status: 'PAID', note: payNote.slice(0, 280) });
      }
      claim.status = 'PAID';
      approved++;
    } else if (!isFraudNarrative) {
      // Human approval with full officer attestation (the accountability slot).
      const approveAt = new Date(Date.now() - (minutesAgo - 40) * 60_000).toISOString();
      const approveNote = `[ops-desk] HUMAN_APPROVED: field officer verified registry & damage on site · [ATTESTED by ${OFFICER}] I accept full responsibility for this decision`;
      if (chainOk) {
        await seal(chain, c.id, approveAt, claim, { status: 'HUMAN_APPROVED', note: approveNote.slice(0, 280) });
      }
      claim.status = 'HUMAN_APPROVED';

      const payAt = new Date(Date.now() - (minutesAgo - 55) * 60_000).toISOString();
      const payNote = `UPI payout ₹${claim.amountRequested} · ref UPI-${c.id.slice(-6)}-${1000 + i} · [ATTESTED by ${OFFICER}] I accept full responsibility for this decision`;
      if (chainOk) {
        await seal(chain, c.id, payAt, claim, { status: 'PAID', note: payNote.slice(0, 280) });
      }
      claim.status = 'PAID';
      approved++;
    } else {
      flagged++;
    }

    console.log(`[mock20] ${c.id} ${c.claimantName} (${c.district}) → ${claim.status} (pipeline ${run.verdict}, score ${run.score})`);
  }

  console.log(`[mock20] ${MOCK_CLIENTS.length} mock claims ready — ${approved} approved/paid, ${flagged} held`);
}

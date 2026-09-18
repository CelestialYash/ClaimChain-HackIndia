import { CLAIM_STATUS, claimIdToBytes32, computeStateHash, type ClaimStatusName } from './chain/chain.js';
import type { ChainClient } from './chain/client.js';
import type { Claim } from './types.js';

interface SeedRecord {
  status: ClaimStatusName;
  note: string;
  minutesAgo: number;
}

interface SeedClaim {
  id: string;
  claimantName: string;
  lossType: Claim['lossType'];
  amountRequested: number;
  minutesAgoSubmitted: number;
  imageHashes: string[];
  trail: SeedRecord[];
}

/**
 * Demo narrative matching the design mockups:
 * - CLM-8919: cross-district pHash collision → AI flags → human review pending
 * - CLM-8920: clean flood claim → auto-approved → paid via UPI
 * - CLM-8930: fresh submission, mid-verification
 */
const SEED_CLAIMS: SeedClaim[] = [
  {
    id: 'CLM-8919',
    claimantName: 'Devendra Singh',
    lossType: 'flood',
    amountRequested: 9200,
    minutesAgoSubmitted: 118,
    imageHashes: ['paddy-plot2-geotag', 'paddy-plot2-dup'],
    trail: [
      { status: 'SUBMITTED', note: 'Claim submitted with photo evidence + geotag (Bhiwandi, Thane MH)', minutesAgo: 118 },
      {
        status: 'AI_FLAGGED',
        note: 'pHash collision: 98.4% similar to archived claim CLM-4102 (Hamming distance 2) — escalated to human review',
        minutesAgo: 96,
      },
    ],
  },
  {
    id: 'CLM-8920',
    claimantName: 'Ramesh Kumar',
    lossType: 'flood',
    amountRequested: 6500,
    minutesAgoSubmitted: 1560,
    imageHashes: ['soybean-lot2-a', 'soybean-lot2-b'],
    trail: [
      { status: 'SUBMITTED', note: 'Claim submitted with photo evidence + geotag (Yavatmal, MH)', minutesAgo: 1560 },
      { status: 'AI_APPROVED', note: 'pHash unique · GPS valid · OCR confidence 99.2%', minutesAgo: 1548 },
      { status: 'PAID', note: 'UPI payout released to Aadhaar-linked account ••4810', minutesAgo: 1544 },
    ],
  },
  {
    id: 'CLM-8930',
    claimantName: 'Sunita Pawar',
    lossType: 'drought',
    amountRequested: 4300,
    minutesAgoSubmitted: 8,
    imageHashes: ['maize-kharif-a'],
    trail: [{ status: 'SUBMITTED', note: 'Claim submitted with photo evidence + geotag (Nanded, MH)', minutesAgo: 8 }],
  },
];

/**
 * Seal the demo claims' trails if the deployed contract has none yet, and
 * register every seed claim in the in-memory store. Idempotent: trails are
 * only sealed when getTrailLength === 0 (fresh deployment).
 */
export async function seedClaims(chain: ChainClient, register: (claim: Claim) => void): Promise<void> {
  if (!chain.enabled || !chain.signerAddress) {
    console.log('[seed] chain disabled — skipping demo seeds');
    return;
  }

  for (const s of SEED_CLAIMS) {
    const id32 = claimIdToBytes32(s.id);

    let trailLen = 0;
    try {
      trailLen = Number(await chain.contract.getTrailLength(id32));
    } catch (err) {
      console.warn('[seed] chain unreachable mid-seed:', (err as Error).message);
      return;
    }

    if (trailLen === 0) {
      for (const r of s.trail) {
        const sealedAt = new Date(Date.now() - r.minutesAgo * 60_000).toISOString();
        const stateHash = computeStateHash({
          claimId: s.id,
          lossType: s.lossType,
          claimantName: s.claimantName,
          amountRequested: s.amountRequested,
          imageHashes: s.imageHashes,
          sealedAt,
        });
        const tx = await chain.contract.sealClaimState(id32, stateHash, CLAIM_STATUS[r.status], r.note);
        await tx.wait();
      }
    }

    // Derive current status from the newest on-chain record.
    const trail = await chain.contract.getAuditTrail(id32);
    const last = trail[trail.length - 1];
    const status =
      (Object.entries(CLAIM_STATUS).find(([, v]) => v === Number(last?.status))?.[0] as ClaimStatusName) ??
      'SUBMITTED';

    register({
      id: s.id,
      claimantName: s.claimantName,
      lossType: s.lossType,
      amountRequested: s.amountRequested,
      status,
      submittedAt: new Date(Date.now() - s.minutesAgoSubmitted * 60_000).toISOString(),
      imageHashes: s.imageHashes,
    });
  }
  console.log(`[seed] ${SEED_CLAIMS.length} demo claims ready`);
}

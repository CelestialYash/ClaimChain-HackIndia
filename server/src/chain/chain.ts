import { ethers } from 'ethers';

/**
 * TypeScript mirror of the ClaimAuditTrail hashing rules.
 * MUST stay byte-identical with blockchain/contracts/ClaimAuditTrail.sol —
 * the Hardhat tests in blockchain/test recompute the same formula.
 */

export const CLAIM_STATUSES = [
  'SUBMITTED',
  'AI_APPROVED',
  'AI_FLAGGED',
  'HUMAN_OVERRIDDEN',
  'PAID',
  'REJECTED',
] as const;

export type ClaimStatusName = (typeof CLAIM_STATUSES)[number];

export const CLAIM_STATUS: Record<ClaimStatusName, number> = {
  SUBMITTED: 0,
  AI_APPROVED: 1,
  AI_FLAGGED: 2,
  HUMAN_OVERRIDDEN: 3,
  PAID: 4,
  REJECTED: 5,
};

export function claimIdToBytes32(claimId: string): string {
  return ethers.id(claimId); // keccak256(utf8(claimId))
}

/**
 * Canonical off-chain state hash of a claim's evidence.
 * Mirrors the pitch formula: keccak256(claimData + pHash + timestamp).
 */
export function computeStateHash(input: {
  claimId: string;
  lossType: string;
  claimantName: string;
  amountRequested: number;
  imageHashes: string[];
  sealedAt: string; // ISO timestamp
}): string {
  return ethers.solidityPackedKeccak256(
    ['string', 'string', 'string', 'uint256', 'bytes32[]', 'string'],
    [
      input.claimId,
      input.lossType,
      input.claimantName,
      BigInt(input.amountRequested),
      input.imageHashes.map((h) => ethers.id(h)),
      input.sealedAt,
    ]
  );
}

/** keccak256(abi.encode(prev, stateHash, status, ts, by, noteHash)) — same as the contract. */
export function computeRecordHash(input: {
  prevRecordHash: string;
  stateHash: string;
  status: number; // uint8
  timestamp: bigint | number; // uint64
  recordedBy: string; // address
  note: string;
}): string {
  const noteHash = ethers.keccak256(ethers.toUtf8Bytes(input.note));
  return ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(
      ['bytes32', 'bytes32', 'uint8', 'uint64', 'address', 'bytes32'],
      [
        input.prevRecordHash,
        input.stateHash,
        input.status,
        input.timestamp,
        input.recordedBy,
        noteHash,
      ]
    )
  );
}

export interface TrailRecord {
  stateHash: string;
  prevRecordHash: string;
  recordHash: string;
  status: number;
  timestamp: bigint;
  recordedBy: string;
  note: string;
}

/**
 * Combined integrity report: off-chain recomputation + the contract's own
 * verifyTrail verdict. The contract signals "intact" with type(uint256).max,
 * which is surfaced as null so JSON never carries a 78-digit sentinel.
 */
export function integrityReport(
  offChainBreak: number | null,
  onChainValid: boolean,
  onChainBrokenAt: bigint
): {
  offChainValid: boolean;
  offChainBreakAtIndex: number | null;
  onChainValid: boolean;
  onChainBreakAtIndex: number | null;
} {
  return {
    offChainValid: offChainBreak === null,
    offChainBreakAtIndex: offChainBreak,
    onChainValid,
    onChainBreakAtIndex:
      onChainValid || onChainBrokenAt === ethers.MaxUint256 ? null : Number(onChainBrokenAt),
  };
}

/**
 * Verify a trail's hash chain off-chain (the "prove" step from the pitch).
 * Returns the index of the first broken record, or null when the chain is intact.
 */
export function findChainBreak(trail: TrailRecord[]): number | null {
  for (let i = 0; i < trail.length; i++) {
    const r = trail[i];
    const expected = computeRecordHash({
      prevRecordHash: r.prevRecordHash,
      stateHash: r.stateHash,
      status: r.status,
      timestamp: r.timestamp,
      recordedBy: r.recordedBy,
      note: r.note,
    });
    if (expected !== r.recordHash) return i;
    const linkOk = i === 0 ? r.prevRecordHash === ethers.ZeroHash : r.prevRecordHash === trail[i - 1].recordHash;
    if (!linkOk) return i;
  }
  return null;
}

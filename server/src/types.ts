import type { ClaimStatusName } from './chain/chain.js';

export interface Claim {
  id: string;
  claimantName: string;
  lossType: 'flood' | 'drought' | 'livestock';
  amountRequested: number;
  status: ClaimStatusName;
  submittedAt: string;
  imageHashes: string[];
  /** Sealed stateHash of the latest on-chain record for this claim. */
  latestStateHash?: string;
}

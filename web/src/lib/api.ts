/**
 * Typed client for the ClaimChain API (server/, port 4000 via Vite proxy).
 */

export interface Health {
  ok: boolean;
  service: string;
  version: string;
  chain: { enabled: boolean; contract: string | null; totalRecords: string | null };
}

export interface Claim {
  id: string;
  claimantName: string;
  lossType: 'flood' | 'drought' | 'livestock';
  amountRequested: number;
  status: 'SUBMITTED' | 'AI_APPROVED' | 'AI_FLAGGED' | 'HUMAN_OVERRIDDEN' | 'PAID' | 'REJECTED';
  submittedAt: string;
  imageHashes: string[];
  latestStateHash?: string;
}

export interface AuditRecord {
  stateHash: string;
  prevRecordHash: string;
  recordHash: string;
  status: number;
  timestamp: string;
  sealedAtIso: string;
  recordedBy: string;
  note: string;
}

export interface AuditTrail {
  claimId: string;
  recordCount: number;
  integrity: {
    offChainValid: boolean;
    offChainBreakAtIndex: number | null;
    onChainValid: boolean;
    onChainBreakAtIndex: number | null;
  };
  records: AuditRecord[];
}

export interface TamperResult {
  demo: 'tamper' | 'restore';
  claimId: string;
  forged?: { recordIndex: number; slot: string; originalStateHash: string; forgedStateHash: string; forgedLabel: string };
  restored?: { recordIndex: number; stateHash: string };
  integrity: AuditTrail['integrity'];
  verdict: string;
}

export interface Stats {
  claimsToday: number;
  total: number;
  autoApproved: number;
  autoApprovalPct: number | null;
  flagged: number;
  leakagePreventedInr: number;
  paidInr: number;
  totalRecords: number | null;
  chainEnabled: boolean;
}

const BASE = '/api';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(BASE + path, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  return body as T;
}

export const api = {
  health: () => request<Health>('/health'),

  stats: () => request<Stats>('/stats'),

  createClaim: (input: { claimantName: string; lossType: string; amountRequested: number; imageHashes?: string[] }) =>
    request<Claim>('/claims', { method: 'POST', body: JSON.stringify(input) }),

  listClaims: () => request<Claim[]>('/claims'),

  getClaim: (id: string) => request<Claim>(`/claims/${id}`),

  sealTransition: (id: string, status: string, note: string) =>
    request<{ claim: Claim; sealed: boolean; txHash: string }>(`/claims/${id}/transitions`, {
      method: 'POST',
      body: JSON.stringify({ status, note }),
    }),

  auditTrail: (id: string) => request<AuditTrail>(`/claims/${id}/audit-trail`),

  tamper: (claimId: string, recordIndex = 1, forgedLabel = 'FORGED-PAYOUT-15000') =>
    request<TamperResult>('/demo/tamper', {
      method: 'POST',
      body: JSON.stringify({ claimId, recordIndex, forgedLabel }),
    }),

  restore: (claimId: string, recordIndex = 1) =>
    request<TamperResult>('/demo/restore', {
      method: 'POST',
      body: JSON.stringify({ claimId, recordIndex }),
    }),
};

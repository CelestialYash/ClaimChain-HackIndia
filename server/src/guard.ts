import { PAYOUT_ELIGIBLE, type ClaimStatusName } from './chain/chain.js';

/**
 * Server-side state machine (CLAIMCHAIN_WORKFLOW.md §4) — the guard the
 * prototype lacked. AI verdicts are pipeline-only; flagged claims are
 * payout-frozen (RULE ZERO); humans can only resolve flagged/rejected claims
 * with a ≥20-char sealed reason.
 */

export class GuardError extends Error {
  constructor(
    public readonly code: string,
    public readonly httpStatus: number,
    message: string
  ) {
    super(message);
    this.name = 'GuardError';
  }
}

/** Human-review transitions: [from-statuses, requiresNote?]. */
const HUMAN_RULES: Record<
  'HUMAN_APPROVED' | 'HUMAN_REJECTED' | 'HUMAN_REVIEW',
  { from: readonly ClaimStatusName[]; minNote: number }
> = {
  HUMAN_APPROVED: { from: ['AI_FLAGGED', 'AI_REJECTED'], minNote: 20 },
  HUMAN_REJECTED: { from: ['AI_FLAGGED', 'AI_REJECTED'], minNote: 20 },
  HUMAN_REVIEW: { from: ['AI_REJECTED'], minNote: 1 },
};

const TERMINAL: readonly ClaimStatusName[] = ['PAID', 'HUMAN_REJECTED'];

/**
 * Officer attestation — the accountability slot. Any human decision that
 * overrides or unlocks what the AI decided (approve/reject a flagged claim,
 * pay a human-approved claim) must carry an explicit attestation naming the
 * issuing officer. It is sealed on-chain WITH the decision, so the officer
 * owns the outcome forever — there is no anonymous override.
 */
export interface OfficerAttestation {
  /** Officer display name (the accountable human). */
  officerName: string;
  /** Officer id (employee/badge id) for unambiguous audit attribution. */
  officerId?: string;
  /** Must be exactly true — the API rejects anything else. */
  acceptsResponsibility: true;
}

const ATTESTATION_PHRASE = 'I accept full responsibility for this decision';

/**
 * Validate + format the attestation into the on-chain note. Throws 400 when
 * the officer has not explicitly accepted responsibility.
 */
export function requireAttestation(
  attestation: OfficerAttestation,
): { sealedText: string; identity: string } {
  if (attestation.acceptsResponsibility !== true) {
    throw new GuardError(
      'ATTESTATION_REQUIRED',
      400,
      'Officer must explicitly accept full responsibility for this decision (attestation.acceptsResponsibility = true) — it will be sealed on-chain under their name'
    );
  }
  const name = attestation.officerName.trim();
  if (name.length < 2) {
    throw new GuardError('ATTESTATION_INVALID', 400, 'officerName is required (min 2 chars) for the sealed attestation');
  }
  const identity = attestation.officerId ? `${name} (${attestation.officerId.trim()})` : name;
  return {
    identity,
    sealedText: `[ATTESTED by ${identity}] ${ATTESTATION_PHRASE}`,
  };
}

/**
 * Validate a requested transition. Throws GuardError on any violation.
 * AI verdicts and PAID can NEVER enter through here — they are set by the
 * verification pipeline and the guarded /pay endpoint respectively.
 */
export function assertTransition(current: ClaimStatusName, next: ClaimStatusName, note: string): void {
  if (next === 'AI_APPROVED' || next === 'AI_FLAGGED' || next === 'AI_REJECTED') {
    throw new GuardError(
      'AI_VERDICTS_ARE_COMPUTED',
      403,
      `AI verdicts are computed by the verification pipeline and cannot be sealed manually (requested ${next})`
    );
  }
  if (next === 'PAID') {
    throw new GuardError('USE_PAY_ENDPOINT', 409, 'Payouts must go through POST /api/claims/:id/pay');
  }
  if (next === 'SUBMITTED' || next === 'HUMAN_OVERRIDDEN' || next === 'REJECTED') {
    throw new GuardError('INVALID_TRANSITION', 409, `Transition to ${next} is not permitted`);
  }
  if (TERMINAL.includes(current)) {
    throw new GuardError('TERMINAL_STATE', 409, `Claim is ${current} (terminal) — no further transitions`);
  }

  const rule = HUMAN_RULES[next as keyof typeof HUMAN_RULES];
  if (rule) {
    if (!rule.from.includes(current)) {
      throw new GuardError(
        'INVALID_TRANSITION',
        409,
        `${next} is only allowed from ${rule.from.join(' / ')} (current: ${current})`
      );
    }
    if (note.trim().length < rule.minNote) {
      throw new GuardError(
        'REASON_TOO_SHORT',
        400,
        `Human ${next.toLowerCase()} requires a reason of at least ${rule.minNote} characters (sealed on-chain)`
      );
    }
    return;
  }

  throw new GuardError('INVALID_TRANSITION', 409, `Unknown transition target ${next}`);
}

/**
 * RULE ZERO: payout eligibility. A flagged claim is a payout freeze; the only
 * unlock is a human approval sealed with a reason.
 */
export function assertPayoutEligible(current: ClaimStatusName): void {
  if (current === 'AI_FLAGGED') {
    throw new GuardError('FLAGGED_LOCKED', 409, 'Claim is flagged for fraud review — human approval required before payout');
  }
  if (!PAYOUT_ELIGIBLE.includes(current)) {
    throw new GuardError('INVALID_STATE', 409, `Payout requires status ${PAYOUT_ELIGIBLE.join(' or ')} (current: ${current})`);
  }
}

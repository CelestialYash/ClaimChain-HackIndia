import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Search, Phone, MapPin, BadgeCheck, ArrowLeft, Landmark, ShieldCheck } from 'lucide-react';
import { api, inr, short, STATUS_META, type ApprovedClaim, type ClaimStatus } from '../lib/api';

/**
 * Approved Claims — the settled-client register. Shows every approved /
 * human-approved / paid claim with the client's contact details as recorded
 * at intake. Demo data uses reserved mock phone/Aadhaar ranges (marked).
 */

const TONE: Record<ClaimStatus, string> = {
  PAID: 'border-[#10b981]/40 bg-[#10b981]/[0.06] text-[#0b7a5c]',
  HUMAN_APPROVED: 'border-[#10b981]/30 bg-[#10b981]/[0.04] text-[#0b7a5c]',
  AI_APPROVED: 'border-black/15 bg-black/[0.03] text-black/70',
  SUBMITTED: 'border-black/10 bg-black/[0.02] text-black/50',
  AI_FLAGGED: 'border-[#f59e0b]/40 bg-[#f59e0b]/[0.06] text-[#b45309]',
  AI_REJECTED: 'border-[#ef4444]/40 bg-[#ef4444]/[0.06] text-[#b91c1c]',
  HUMAN_REVIEW: 'border-[#f59e0b]/40 bg-[#f59e0b]/[0.06] text-[#b45309]',
  HUMAN_REJECTED: 'border-[#ef4444]/40 bg-[#ef4444]/[0.06] text-[#b91c1c]',
  HUMAN_OVERRIDDEN: 'border-[#f59e0b]/40 bg-[#f59e0b]/[0.06] text-[#b45309]',
  REJECTED: 'border-[#ef4444]/40 bg-[#ef4444]/[0.06] text-[#b91c1c]',
};

function Row({ c }: { c: ApprovedClaim }) {
  return (
    <tr className="border-t border-black/[0.06] align-top hover:bg-black/[0.015]">
      <td className="px-4 py-3">
        <p className="text-sm font-semibold text-black">{c.claimantName}</p>
        <p className="font-mono text-[10px] text-black/40">{c.claimId}</p>
      </td>
      <td className="px-4 py-3">
        <p className="flex items-center gap-1.5 text-xs text-black/80">
          <Phone className="h-3 w-3 text-black/40" /> +91 {c.phone}
        </p>
        <p className="mt-0.5 font-mono text-[10px] text-black/40">aadhaar {c.aadhaarMasked}</p>
      </td>
      <td className="px-4 py-3">
        <p className="flex items-start gap-1.5 text-xs text-black/80">
          <MapPin className="mt-0.5 h-3 w-3 shrink-0 text-black/40" />
          <span>
            {c.village}
            <br />
            <span className="text-black/50">{c.district} district</span>
          </span>
        </p>
      </td>
      <td className="px-4 py-3 text-xs capitalize text-black/80">{c.lossType}</td>
      <td className="px-4 py-3">
        <p className="text-sm font-semibold text-black">{inr(c.amountRequested)}</p>
        <p className="font-mono text-[10px] text-black/40">{c.policyNumber}</p>
      </td>
      <td className="px-4 py-3">
        <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${TONE[c.status]}`}>
          {c.status === 'PAID' && <BadgeCheck className="h-3 w-3" />}
          {STATUS_META[c.status].label}
        </span>
      </td>
      <td className="px-4 py-3 font-mono text-[10px] text-black/40">
        {c.latestStateHash ? short(c.latestStateHash) : '—'}
        <br />
        {new Date(c.decidedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
      </td>
    </tr>
  );
}

export default function ApprovedClaims() {
  const [q, setQ] = useState('');
  const [only, setOnly] = useState<'all' | 'PAID'>('all');
  const { data, isLoading, isError } = useQuery({ queryKey: ['approved'], queryFn: () => api.approvedClaims(), refetchInterval: 8000 });

  const rows = useMemo(() => {
    let list = data?.claims ?? [];
    if (only === 'PAID') list = list.filter((c) => c.status === 'PAID');
    const needle = q.trim().toLowerCase();
    if (needle) {
      list = list.filter((c) =>
        [c.claimantName, c.phone, c.district, c.village, c.claimId, c.policyNumber, c.aadhaarMasked]
          .join(' ')
          .toLowerCase()
          .includes(needle),
      );
    }
    return list;
  }, [data, q, only]);

  return (
    <main className="min-h-screen bg-[#F5F5F5]">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <Link to="/console" className="mb-6 inline-flex items-center gap-2 text-xs font-medium text-black/50 transition-colors hover:text-black">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Console
        </Link>

        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-[-0.03em] text-black">Approved Claims</h1>
            <p className="mt-1 text-sm text-black/50">
              Settled clients with contact details on file — every decision sealed on-chain with an officer attestation.
            </p>
          </div>
          <div className="rounded-2xl border border-black/10 bg-white px-5 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-black/40">Total paid</p>
            <p className="text-2xl font-semibold tracking-tight text-[#0b7a5c]">{data ? inr(data.totalPaidInr) : '…'}</p>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 sm:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-black/30" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name, phone, village, policy…"
              className="w-full rounded-full border border-black/10 bg-white py-2.5 pl-9 pr-4 text-sm text-black outline-none focus:border-black"
            />
          </div>
          <div className="flex rounded-full border border-black/10 bg-white p-1">
            {(['all', 'PAID'] as const).map((k) => (
              <button
                key={k}
                onClick={() => setOnly(k)}
                className={`rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${only === k ? 'bg-black text-white' : 'text-black/60 hover:text-black'}`}
              >
                {k === 'all' ? 'All approved' : 'Paid only'}
              </button>
            ))}
          </div>
          <span className="ml-auto flex items-center gap-1.5 text-[10px] text-black/40">
            <Landmark className="h-3 w-3" /> demo dataset · mock contact values
          </span>
        </div>

        <div className="overflow-hidden rounded-2xl border border-black/10 bg-white">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-[#FAFAFA] text-[10px] font-semibold uppercase tracking-widest text-black/40">
                <th className="px-4 py-3">Client</th>
                <th className="px-4 py-3">Contact</th>
                <th className="px-4 py-3">Location</th>
                <th className="px-4 py-3">Loss</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Sealed</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center">
                    <p className="text-sm font-medium text-black">Loading register…</p>
                    <p className="mt-1 text-xs text-black/40">
                      Fresh deploys take ~2.5 min — the AI pipeline verifies all 20 demo claims in real time before the register fills.
                    </p>
                  </td>
                </tr>
              )}
              {isError && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm text-[#b91c1c]">
                    Could not reach the API — is the server running on :4000?
                  </td>
                </tr>
              )}
              {!isLoading && !isError && rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm text-black/40">
                    No approved claims match “{q}”.
                  </td>
                </tr>
              )}
              {rows.map((c) => (
                <Row key={c.claimId} c={c} />
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-4 flex items-center gap-1.5 text-[11px] leading-snug text-black/40">
          <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
          Demo note: names and places are realistic (Maharashtra village-directory localities); phone numbers use the reserved
          11-docfake range and Aadhaars the 0000-0000-XXXX demo convention — no real person's data.
        </p>
      </div>
    </main>
  );
}

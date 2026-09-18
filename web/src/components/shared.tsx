import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

export function Chip({ tone, children }: { tone: 'ok' | 'ai' | 'warn' | 'bad' | 'muted'; children: React.ReactNode }) {
  const tones: Record<string, string> = {
    ok: 'text-status-verified border-status-verified/30 bg-status-verified/10',
    ai: 'text-status-ai border-status-ai/30 bg-status-ai/10',
    warn: 'text-status-review border-status-review/30 bg-status-review/10',
    bad: 'text-status-tamper border-status-tamper/30 bg-status-tamper/10',
    muted: 'text-text-muted border-border-subtle bg-surface-overlay',
  };
  const dot: Record<string, string> = {
    ok: 'bg-status-verified',
    ai: 'bg-status-ai',
    warn: 'bg-status-review',
    bad: 'bg-status-tamper',
    muted: 'bg-text-muted',
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-widest ${tones[tone]}`}
    >
      <span className={`inline-block h-1.5 w-1.5 rounded-full ${dot[tone]}`} />
      {children}
    </span>
  );
}

export function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-lg border border-border-subtle bg-surface-card shadow-sm ${className}`}>{children}</div>
  );
}

export const STATUS_TONE: Record<string, 'ok' | 'ai' | 'warn' | 'bad' | 'muted'> = {
  SUBMITTED: 'ai',
  AI_APPROVED: 'ok',
  AI_FLAGGED: 'warn',
  HUMAN_OVERRIDDEN: 'warn',
  PAID: 'ok',
  REJECTED: 'bad',
};

export const STATUS_LABEL: Record<number, string> = {
  0: 'SUBMITTED',
  1: 'AI_APPROVED',
  2: 'AI_FLAGGED',
  3: 'HUMAN_OVERRIDDEN',
  4: 'PAID',
  5: 'REJECTED',
};

export const short = (h: string) => (h.length > 14 ? `${h.slice(0, 8)}…${h.slice(-4)}` : h);

export const ZERO_HASH = '0x0000000000000000000000000000000000000000000000000000000000000000';

/** KPI strip fed by /api/stats — live institutional metrics. */
export function KpiStrip() {
  const stats = useQuery({ queryKey: ['stats'], queryFn: api.stats, refetchInterval: 5000 });
  const s = stats.data;
  const fmtInr = (n: number) =>
    n >= 100000 ? `₹${(n / 100000).toFixed(2)} L` : `₹${n.toLocaleString('en-IN')}`;

  const cards = [
    { label: 'Claims today', value: s ? String(s.claimsToday) : '—', tone: 'text-text-primary' },
    {
      label: 'Auto-approval rate',
      value: s?.autoApprovalPct != null ? `${s.autoApprovalPct}%` : '—',
      tone: 'text-status-verified',
    },
    { label: 'Flagged for review', value: s ? String(s.flagged) : '—', tone: 'text-status-review' },
    { label: 'Leakage prevented', value: s ? fmtInr(s.leakagePreventedInr) : '—', tone: 'text-status-tamper' },
    { label: 'Paid out', value: s ? fmtInr(s.paidInr) : '—', tone: 'text-status-ai' },
    { label: 'Sealed records', value: s?.totalRecords != null ? String(s.totalRecords) : '—', tone: 'text-text-primary' },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      {cards.map((c) => (
        <Card key={c.label} className="p-3">
          <span className="block font-mono text-[9px] uppercase tracking-widest text-text-muted">{c.label}</span>
          <span className={`mt-1 block font-mono text-lg font-bold ${c.tone}`}>{c.value}</span>
        </Card>
      ))}
    </div>
  );
}

export function OfflineBanner() {
  const health = useQuery({ queryKey: ['health'], queryFn: api.health, refetchInterval: 5000 });
  if (health.data?.chain.enabled) return null;
  return (
    <Card className="mb-4 border-status-review/40 bg-status-review/5 p-3">
      <p className="font-mono text-xs text-status-review">
        ⚠ Chain offline — start the stack: <span className="text-text-primary">npm run demo</span>
      </p>
    </Card>
  );
}

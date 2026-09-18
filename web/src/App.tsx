import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type AuditTrail, type Claim } from './lib/api';

// ---------------------------------------------------------------------------
// Small building blocks (dense forensic styling per DESIGN_SYSTEM.md)
// ---------------------------------------------------------------------------

function Chip({ tone, children }: { tone: 'ok' | 'ai' | 'warn' | 'bad' | 'muted'; children: React.ReactNode }) {
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
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-widest ${tones[tone]}`}>
      <span className={`inline-block h-1.5 w-1.5 rounded-full ${dot[tone]}`} />
      {children}
    </span>
  );
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-lg border border-border-subtle bg-surface-card shadow-sm ${className}`}>{children}</div>;
}

const STATUS_TONE: Record<string, 'ok' | 'ai' | 'warn' | 'bad' | 'muted'> = {
  SUBMITTED: 'ai',
  AI_APPROVED: 'ok',
  AI_FLAGGED: 'warn',
  HUMAN_OVERRIDDEN: 'warn',
  PAID: 'ok',
  REJECTED: 'bad',
};

const STATUS_LABEL: Record<number, string> = {
  0: 'SUBMITTED',
  1: 'AI_APPROVED',
  2: 'AI_FLAGGED',
  3: 'HUMAN_OVERRIDDEN',
  4: 'PAID',
  5: 'REJECTED',
};

const short = (h: string) => (h.length > 14 ? `${h.slice(0, 8)}…${h.slice(-4)}` : h);

// ---------------------------------------------------------------------------
// Claim form
// ---------------------------------------------------------------------------

function ClaimForm({ onCreated }: { onCreated: (id: string) => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState('Ramesh Kumar');
  const [lossType, setLossType] = useState('flood');
  const [amount, setAmount] = useState(6500);
  const [photos, setPhotos] = useState(2);

  const create = useMutation({
    mutationFn: () =>
      api.createClaim({
        claimantName: name,
        lossType,
        amountRequested: amount,
        imageHashes: Array.from({ length: photos }, (_, i) => `photo-${i + 1}-geohash`),
      }),
    onSuccess: (claim) => {
      qc.invalidateQueries({ queryKey: ['claims'] });
      qc.invalidateQueries({ queryKey: ['health'] });
      onCreated(claim.id);
    },
  });

  const lossTypes = [
    { id: 'flood', icon: '🌊', label: 'Flood' },
    { id: 'drought', icon: '☀️', label: 'Drought' },
    { id: 'livestock', icon: '🐄', label: 'Livestock' },
  ];

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold tracking-tight text-text-primary">New Claim Intake</h2>
        <Chip tone="ai">AI-assisted</Chip>
      </div>

      <div className="mb-4 grid grid-cols-3 gap-2">
        {lossTypes.map((t) => (
          <button
            key={t.id}
            onClick={() => setLossType(t.id)}
            className={`rounded-lg border p-3 text-left transition-colors ${
              lossType === t.id
                ? 'border-status-ai/50 bg-status-ai/10'
                : 'border-border-subtle bg-surface-muted hover:border-border-strong'
            }`}
          >
            <span className="text-lg">{t.icon}</span>
            <p className="mt-1 text-xs font-medium text-text-primary">{t.label}</p>
          </button>
        ))}
      </div>

      <label className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-text-muted">Claimant</label>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="mb-3 w-full rounded-md border border-border-subtle bg-surface-base px-3 py-2 text-sm text-text-primary outline-none focus:border-status-ai"
      />

      <label className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-text-muted">Amount (₹)</label>
      <input
        type="number"
        value={amount}
        onChange={(e) => setAmount(Number(e.target.value))}
        className="mb-3 w-full rounded-md border border-border-subtle bg-surface-base px-3 py-2 font-mono text-sm text-text-primary outline-none focus:border-status-ai"
      />

      <label className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-text-muted">
        Field photos (geotagged)
      </label>
      <div className="mb-4 flex gap-2">
        {[1, 2, 3].map((n) => (
          <button
            key={n}
            onClick={() => setPhotos(n)}
            className={`flex h-12 flex-1 items-center justify-center rounded-md border font-mono text-xs ${
              photos === n
                ? 'border-status-ai/50 bg-status-ai/10 text-status-ai'
                : 'border-border-subtle bg-surface-muted text-text-muted hover:border-border-strong'
            }`}
          >
            📷 ×{n}
          </button>
        ))}
      </div>

      <button
        disabled={create.isPending || !name.trim()}
        onClick={() => create.mutate()}
        className="h-10 w-full rounded-md bg-status-ai font-semibold text-surface-base transition-opacity hover:opacity-90 disabled:opacity-40"
      >
        {create.isPending ? 'Sealing on-chain…' : 'Submit & Seal Genesis Record'}
      </button>
      {create.isError && <p className="mt-2 font-mono text-xs text-status-tamper">{(create.error as Error).message}</p>}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Audit trail timeline
// ---------------------------------------------------------------------------

function TrailTimeline({ trail }: { trail: AuditTrail }) {
  const ok = trail.integrity.offChainValid && trail.integrity.onChainValid;
  return (
    <div className="relative">
      <div className={`absolute bottom-4 left-[15px] top-4 w-px border-l border-dashed ${ok ? 'border-border-strong' : 'border-status-tamper/60'}`} />
      <div className="space-y-3">
        {trail.records.map((r, i) => (
          <div key={r.recordHash} className="relative flex gap-3 pl-0">
            <div
              className={`z-10 mt-1 flex h-8 w-8 flex-none items-center justify-center rounded-md border font-mono text-[10px] font-bold ${
                ok ? 'border-status-ai/30 bg-status-ai/10 text-status-ai' : 'border-status-tamper/40 bg-status-tamper/10 text-status-tamper'
              }`}
            >
              {i}
            </div>
            <div className="min-w-0 flex-1 rounded-md border border-border-subtle bg-surface-muted p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Chip tone={STATUS_TONE[STATUS_LABEL[r.status]] ?? 'muted'}>{STATUS_LABEL[r.status] ?? r.status}</Chip>
                <span className="font-mono text-[10px] text-text-muted">
                  {new Date(r.sealedAtIso).toLocaleTimeString()} · block-sealed
                </span>
              </div>
              <p className="mt-1.5 truncate text-xs text-text-secondary">{r.note}</p>
              <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-[10px]">
                <span className="truncate text-text-muted">
                  rec <span className="text-text-secondary">{short(r.recordHash)}</span>
                </span>
                <span className="truncate text-text-muted">
                  prev <span className="text-text-secondary">{r.prevRecordHash === '0x0000000000000000000000000000000000000000000000000000000000000000' ? 'GENESIS' : short(r.prevRecordHash)}</span>
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main app
// ---------------------------------------------------------------------------

export default function App() {
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [demoMsg, setDemoMsg] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null);

  const health = useQuery({ queryKey: ['health'], queryFn: api.health, refetchInterval: 5000 });
  const claims = useQuery({ queryKey: ['claims'], queryFn: api.listClaims, refetchInterval: 5000 });

  // Auto-select the newest claim after creation.
  useEffect(() => {
    if (!selectedId && claims.data && claims.data.length > 0) {
      setSelectedId(claims.data[claims.data.length - 1].id);
    }
  }, [claims.data, selectedId]);

  const trail = useQuery({
    queryKey: ['trail', selectedId],
    queryFn: () => api.auditTrail(selectedId!),
    enabled: !!selectedId,
    refetchInterval: 4000,
  });

  const selected: Claim | undefined = useMemo(
    () => claims.data?.find((c) => c.id === selectedId),
    [claims.data, selectedId]
  );

  const seal = useMutation({
    mutationFn: ({ status, note }: { status: string; note: string }) =>
      api.sealTransition(selectedId!, status, note),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['claims'] });
      qc.invalidateQueries({ queryKey: ['trail', selectedId] });
      qc.invalidateQueries({ queryKey: ['health'] });
    },
  });

  const tamper = useMutation({
    mutationFn: () => api.tamper(selectedId!, 1),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['trail', selectedId] });
      setDemoMsg({ tone: 'bad', text: r.verdict });
    },
  });

  const restore = useMutation({
    mutationFn: () => api.restore(selectedId!, 1),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['trail', selectedId] });
      setDemoMsg({ tone: 'ok', text: r.verdict });
    },
  });

  const chainOk = health.data?.chain.enabled;
  const integrity = trail.data?.integrity;
  const tampered = integrity ? !integrity.offChainValid || !integrity.onChainValid : false;

  return (
    <div className="min-h-screen bg-surface-base font-sans text-sm text-text-secondary">
      {/* Header / telemetry bar */}
      <header className="sticky top-0 z-20 border-b border-border-subtle bg-surface-base/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-status-ai/15">
              <span className="font-mono text-sm font-bold text-status-ai">⛓</span>
            </div>
            <div>
              <span className="block text-sm font-semibold tracking-tight text-text-primary">ClaimChain</span>
              <span className="block font-mono text-[9px] uppercase tracking-[0.2em] text-text-muted">Enterprise Forensic Core</span>
            </div>
          </div>
          <div className="flex items-center gap-3 font-mono text-[10px]">
            {chainOk ? (
              <Chip tone="ok">chain live</Chip>
            ) : (
              <Chip tone="bad">chain offline</Chip>
            )}
            <span className="hidden rounded border border-border-subtle bg-surface-card px-2 py-1 text-text-muted sm:block">
              records: <span className="text-status-ai">{health.data?.chain.totalRecords ?? '—'}</span>
            </span>
            <span className="hidden rounded border border-border-subtle bg-surface-card px-2 py-1 text-text-muted lg:block">
              {short(health.data?.chain.contract ?? '')}
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6">
        {!chainOk && (
          <Card className="mb-4 border-status-review/40 bg-status-review/5 p-3">
            <p className="font-mono text-xs text-status-review">
              ⚠ Chain offline — start the backend: <span className="text-text-primary">bash server/scripts/smoke-test.sh</span> (or hardhat node + deploy + API).
            </p>
          </Card>
        )}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          {/* Left column: intake + queue */}
          <div className="flex flex-col gap-4 lg:col-span-4">
            <ClaimForm onCreated={setSelectedId} />

            <Card className="overflow-hidden">
              <div className="border-b border-border-subtle px-4 py-2.5">
                <h2 className="text-sm font-semibold text-text-primary">Claims Queue</h2>
              </div>
              <div className="max-h-72 overflow-y-auto">
                {(claims.data ?? []).length === 0 && (
                  <p className="px-4 py-6 text-center text-xs text-text-muted">No claims yet — submit one above.</p>
                )}
                {(claims.data ?? []).map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setSelectedId(c.id)}
                    className={`flex w-full items-center justify-between border-b border-border-subtle px-4 py-2.5 text-left transition-colors last:border-0 ${
                      selectedId === c.id ? 'bg-surface-overlay' : 'hover:bg-surface-muted'
                    }`}
                  >
                    <div className="min-w-0">
                      <span className="block font-mono text-xs text-text-primary">{c.id}</span>
                      <span className="block truncate text-[11px] text-text-muted">{c.claimantName} · {c.lossType}</span>
                    </div>
                    <div className="flex flex-none items-center gap-2">
                      <span className="font-mono text-[11px] text-text-secondary">₹{c.amountRequested.toLocaleString('en-IN')}</span>
                      <Chip tone={STATUS_TONE[c.status] ?? 'muted'}>{c.status}</Chip>
                    </div>
                  </button>
                ))}
              </div>
            </Card>
          </div>

          {/* Right column: forensics */}
          <div className="flex flex-col gap-4 lg:col-span-8">
            {/* Selected claim + actions */}
            <Card className="p-5">
              {!selected ? (
                <p className="py-8 text-center text-xs text-text-muted">Select or create a claim to begin forensic inspection.</p>
              ) : (
                <>
                  <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="flex items-center gap-2 font-mono text-base font-semibold text-text-primary">
                        {selected.id}
                        <Chip tone={STATUS_TONE[selected.status] ?? 'muted'}>{selected.status}</Chip>
                      </h2>
                      <p className="mt-0.5 text-xs text-text-muted">
                        {selected.claimantName} · {selected.lossType} loss · {selected.imageHashes.length} geotagged photo(s)
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="block font-mono text-[9px] uppercase tracking-widest text-text-muted">Requested</span>
                      <span className="font-mono text-lg font-bold text-text-primary">₹{selected.amountRequested.toLocaleString('en-IN')}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      disabled={seal.isPending || !chainOk}
                      onClick={() => seal.mutate({ status: 'AI_APPROVED', note: 'pHash unique · GPS valid · OCR confidence 99.2%' })}
                      className="h-8 rounded-md bg-status-verified px-3 text-xs font-semibold text-surface-base hover:opacity-90 disabled:opacity-40"
                    >
                      ✓ AI Approve
                    </button>
                    <button
                      disabled={seal.isPending || !chainOk}
                      onClick={() => seal.mutate({ status: 'AI_FLAGGED', note: 'pHash collision detected — escalated to human review' })}
                      className="h-8 rounded-md bg-status-review px-3 text-xs font-semibold text-surface-base hover:opacity-90 disabled:opacity-40"
                    >
                      ⚑ AI Flag
                    </button>
                    <button
                      disabled={seal.isPending || !chainOk}
                      onClick={() => seal.mutate({ status: 'PAID', note: 'UPI payout released to Aadhaar-linked account' })}
                      className="h-8 rounded-md bg-status-ai px-3 text-xs font-semibold text-surface-base hover:opacity-90 disabled:opacity-40"
                    >
                      ₹ Pay via UPI
                    </button>
                    <div className="mx-1 w-px self-stretch bg-border-subtle" />
                    <button
                      disabled={tamper.isPending || restore.isPending || !chainOk}
                      onClick={() => tamper.mutate()}
                      className="h-8 rounded-md border border-status-tamper bg-status-tamper/10 px-3 font-mono text-xs text-status-tamper hover:bg-status-tamper/20 disabled:opacity-40"
                    >
                      {tamper.isPending ? 'forging…' : '⚡ Attempt Retro-Edit'}
                    </button>
                    <button
                      disabled={restore.isPending || tamper.isPending || !chainOk}
                      onClick={() => restore.mutate()}
                      className="h-8 rounded-md border border-border-subtle bg-surface-muted px-3 font-mono text-xs text-text-secondary hover:text-text-primary disabled:opacity-40"
                    >
                      {restore.isPending ? 'restoring…' : '↺ Restore'}
                    </button>
                  </div>

                  {seal.isError && <p className="mt-2 font-mono text-xs text-status-tamper">{(seal.error as Error).message}</p>}

                  {demoMsg && (
                    <div
                      className={`mt-3 rounded-md border p-3 font-mono text-xs ${
                        demoMsg.tone === 'bad'
                          ? 'border-status-tamper/40 bg-status-tamper/10 text-status-tamper'
                          : 'border-status-verified/40 bg-status-verified/10 text-status-verified'
                      }`}
                    >
                      {demoMsg.text}
                    </div>
                  )}
                </>
              )}
            </Card>

            {/* Immutable audit trail */}
            <Card className="overflow-hidden">
              <div className="flex items-center justify-between border-b border-border-subtle px-4 py-2.5">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-text-primary">
                  Immutable Audit Trail
                  {trail.data && (tampered ? <Chip tone="bad">hash mismatch</Chip> : <Chip tone="ok">100% valid</Chip>)}
                </h2>
                {trail.data && (
                  <span className="font-mono text-[10px] text-text-muted">
                    {trail.data.recordCount} sealed record(s)
                  </span>
                )}
              </div>
              <div className="p-4">
                {trail.isLoading || !trail.data ? (
                  <p className="py-8 text-center text-xs text-text-muted">
                    {selectedId ? 'Reading audit trail from chain…' : 'No claim selected.'}
                  </p>
                ) : trail.data.recordCount === 0 ? (
                  <p className="py-8 text-center text-xs text-text-muted">No records sealed for this claim yet.</p>
                ) : (
                  <TrailTimeline trail={trail.data} />
                )}
              </div>
            </Card>

            {/* Integrity report strip */}
            {integrity && (
              <Card className={`p-4 ${tampered ? 'border-status-tamper/40' : ''}`}>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div>
                    <span className="block font-mono text-[9px] uppercase tracking-widest text-text-muted">Off-chain verify</span>
                    <span className={`font-mono text-sm font-bold ${integrity.offChainValid ? 'text-status-verified' : 'text-status-tamper'}`}>
                      {integrity.offChainValid ? 'VALID' : `BREAK @ ${integrity.offChainBreakAtIndex}`}
                    </span>
                  </div>
                  <div>
                    <span className="block font-mono text-[9px] uppercase tracking-widest text-text-muted">On-chain verify</span>
                    <span className={`font-mono text-sm font-bold ${integrity.onChainValid ? 'text-status-verified' : 'text-status-tamper'}`}>
                      {integrity.onChainValid ? 'VALID' : `BREAK @ ${integrity.onChainBreakAtIndex}`}
                    </span>
                  </div>
                  <div>
                    <span className="block font-mono text-[9px] uppercase tracking-widest text-text-muted">Records</span>
                    <span className="font-mono text-sm font-bold text-text-primary">{trail.data?.recordCount ?? 0}</span>
                  </div>
                  <div>
                    <span className="block font-mono text-[9px] uppercase tracking-widest text-text-muted">Ledger</span>
                    <span className="font-mono text-sm font-bold text-status-ai">{chainOk ? 'LIVE' : 'OFF'}</span>
                  </div>
                </div>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

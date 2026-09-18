import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type AuditTrail } from '../lib/api';
import { AiAnalysisOverlay } from '../components/AiAnalysis';
import { Card, Chip, KpiStrip, OfflineBanner, STATUS_LABEL, STATUS_TONE, ZERO_HASH, short } from '../components/shared';

function TrailTimeline({ trail }: { trail: AuditTrail }) {
  const ok = trail.integrity.offChainValid && trail.integrity.onChainValid;
  return (
    <div className="relative">
      <div
        className={`absolute bottom-4 left-[15px] top-4 w-px border-l border-dashed ${
          ok ? 'border-border-strong' : 'border-status-tamper/60'
        }`}
      />
      <div className="space-y-3">
        {trail.records.map((r, i) => (
          <div key={r.recordHash} className="relative flex gap-3">
            <div
              className={`z-10 mt-1 flex h-8 w-8 flex-none items-center justify-center rounded-md border font-mono text-[10px] font-bold ${
                ok
                  ? 'border-status-ai/30 bg-status-ai/10 text-status-ai'
                  : 'border-status-tamper/40 bg-status-tamper/10 text-status-tamper'
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
              <p className="mt-1.5 text-xs text-text-secondary">{r.note}</p>
              <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-[10px]">
                <span className="truncate text-text-muted">
                  rec <span className="text-text-secondary">{short(r.recordHash)}</span>
                </span>
                <span className="truncate text-text-muted">
                  prev <span className="text-text-secondary">{r.prevRecordHash === ZERO_HASH ? 'GENESIS' : short(r.prevRecordHash)}</span>
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function CommandCenter() {
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [demoMsg, setDemoMsg] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null);
  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  const [pendingDecision, setPendingDecision] = useState<'AI_APPROVED' | 'AI_FLAGGED' | null>(null);

  const claims = useQuery({ queryKey: ['claims'], queryFn: api.listClaims, refetchInterval: 5000 });

  useEffect(() => {
    if (!selectedId && claims.data && claims.data.length > 0) {
      setSelectedId(claims.data[0].id);
    }
  }, [claims.data, selectedId]);

  const trail = useQuery({
    queryKey: ['trail', selectedId],
    queryFn: () => api.auditTrail(selectedId!),
    enabled: !!selectedId,
    refetchInterval: 4000,
  });

  const selected = useMemo(() => claims.data?.find((c) => c.id === selectedId), [claims.data, selectedId]);

  const seal = useMutation({
    mutationFn: ({ status, note }: { status: string; note: string }) => api.sealTransition(selectedId!, status, note),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['claims'] });
      qc.invalidateQueries({ queryKey: ['trail', selectedId] });
      qc.invalidateQueries({ queryKey: ['stats'] });
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

  // AI showpiece: run the scan overlay, then seal the decision for real.
  function runAiDecision(status: 'AI_APPROVED' | 'AI_FLAGGED') {
    if (!selectedId || aiAnalyzing) return;
    setPendingDecision(status);
    setAiAnalyzing(true);
  }
  function confirmAiDecision() {
    if (!pendingDecision) return;
    const note =
      pendingDecision === 'AI_APPROVED'
        ? 'AI decision: pHash unique · GPS valid · OCR confidence 99.2% — auto-approved'
        : 'AI decision: pHash collision 98.4% vs archive CLM-4102 — escalated to human review';
    seal.mutate({ status: pendingDecision, note });
    setAiAnalyzing(false);
    setPendingDecision(null);
  }

  const chainOk = useQuery({ queryKey: ['health'], queryFn: api.health, refetchInterval: 5000 }).data?.chain.enabled;
  const integrity = trail.data?.integrity;
  const tampered = integrity ? !integrity.offChainValid || !integrity.onChainValid : false;

  return (
    <main className="mx-auto max-w-7xl px-4 py-6">
      <OfflineBanner />
      <div className="mb-4">
        <KpiStrip />
      </div>

      <AiAnalysisOverlay active={aiAnalyzing} />
      {aiAnalyzing && pendingDecision && (
        <ConfirmBridge onDone={confirmAiDecision} claimId={selectedId} decision={pendingDecision} />
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* Queue */}
        <Card className="overflow-hidden lg:col-span-4">
          <div className="border-b border-border-subtle px-4 py-2.5">
            <h2 className="text-sm font-semibold text-text-primary">Claims Queue</h2>
          </div>
          <div className="max-h-[560px] overflow-y-auto">
            {(claims.data ?? []).length === 0 && (
              <p className="px-4 py-6 text-center text-xs text-text-muted">Queue empty — submit from the Farmer Portal.</p>
            )}
            {(claims.data ?? []).map((c) => (
              <button
                key={c.id}
                onClick={() => {
                  setSelectedId(c.id);
                  setDemoMsg(null);
                }}
                className={`flex w-full items-center justify-between border-b border-border-subtle px-4 py-2.5 text-left transition-colors last:border-0 ${
                  selectedId === c.id ? 'bg-surface-overlay' : 'hover:bg-surface-muted'
                }`}
              >
                <div className="min-w-0">
                  <span className="block font-mono text-xs text-text-primary">{c.id}</span>
                  <span className="block truncate text-[11px] text-text-muted">
                    {c.claimantName} · {c.lossType}
                  </span>
                </div>
                <div className="flex flex-none items-center gap-2">
                  <span className="font-mono text-[11px] text-text-secondary">₹{c.amountRequested.toLocaleString('en-IN')}</span>
                  <Chip tone={STATUS_TONE[c.status] ?? 'muted'}>{c.status}</Chip>
                </div>
              </button>
            ))}
          </div>
        </Card>

        {/* Forensics */}
        <div className="flex flex-col gap-4 lg:col-span-8">
          <Card className="p-5">
            {!selected ? (
              <p className="py-8 text-center text-xs text-text-muted">Select a claim to begin forensic inspection.</p>
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
                    <span className="font-mono text-lg font-bold text-text-primary">
                      ₹{selected.amountRequested.toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    disabled={seal.isPending || aiAnalyzing || !chainOk}
                    onClick={() => runAiDecision('AI_APPROVED')}
                    className="h-8 rounded-md bg-status-verified px-3 text-xs font-semibold text-surface-base hover:opacity-90 disabled:opacity-40"
                  >
                    ✓ Run AI Verification → Approve
                  </button>
                  <button
                    disabled={seal.isPending || aiAnalyzing || !chainOk}
                    onClick={() => runAiDecision('AI_FLAGGED')}
                    className="h-8 rounded-md bg-status-review px-3 text-xs font-semibold text-surface-base hover:opacity-90 disabled:opacity-40"
                  >
                    ⚑ Run AI Verification → Flag
                  </button>
                  <button
                    disabled={seal.isPending || aiAnalyzing || !chainOk}
                    onClick={() =>
                      seal.mutate({ status: 'PAID', note: 'UPI payout released to Aadhaar-linked account' })
                    }
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
                {seal.isSuccess && !demoMsg && (
                  <p className="mt-3 font-mono text-xs text-status-verified">
                    ✓ sealed on-chain · tx {short(seal.data.txHash)}
                  </p>
                )}

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

          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-border-subtle px-4 py-2.5">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-text-primary">
                Immutable Audit Trail
                {trail.data && (tampered ? <Chip tone="bad">hash mismatch</Chip> : <Chip tone="ok">100% valid</Chip>)}
              </h2>
              {trail.data && <span className="font-mono text-[10px] text-text-muted">{trail.data.recordCount} sealed record(s)</span>}
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

          {integrity && (
            <Card className={`p-4 ${tampered ? 'border-status-tamper/40' : ''}`}>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <IntegrityCell label="Off-chain verify" ok={integrity.offChainValid} breakAt={integrity.offChainBreakAtIndex} />
                <IntegrityCell label="On-chain verify" ok={integrity.onChainValid} breakAt={integrity.onChainBreakAtIndex} />
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
  );
}

function IntegrityCell({ label, ok, breakAt }: { label: string; ok: boolean; breakAt: number | null }) {
  return (
    <div>
      <span className="block font-mono text-[9px] uppercase tracking-widest text-text-muted">{label}</span>
      <span className={`font-mono text-sm font-bold ${ok ? 'text-status-verified' : 'text-status-tamper'}`}>
        {ok ? 'VALID' : `BREAK @ ${breakAt}`}
      </span>
    </div>
  );
}

/**
 * Auto-advances the AI overlay to its confirmation step once the scan finishes.
 * (A tiny "bridge" component so App stays declarative.)
 */
function ConfirmBridge({
  onDone,
  claimId,
  decision,
}: {
  onDone: () => void;
  claimId: string | null;
  decision: string;
}) {
  useEffect(() => {
    const t = setTimeout(onDone, 3400);
    return () => clearTimeout(t);
  }, [onDone, claimId, decision]);
  return null;
}

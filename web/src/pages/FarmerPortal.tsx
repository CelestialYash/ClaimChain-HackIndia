import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { AiAnalysisOverlay } from '../components/AiAnalysis';
import { Card, Chip, OfflineBanner, STATUS_TONE } from '../components/shared';

/**
 * Farmer Portal — calm, large-target, low-literacy design (design screens 01/02):
 * pick what happened → snap photos → done. Status in plain language.
 */

const PLAIN_STATUS: Record<string, { text: string; tone: 'ok' | 'ai' | 'warn' | 'bad' | 'muted' }> = {
  SUBMITTED: { text: 'We got your claim — checking now', tone: 'ai' },
  AI_APPROVED: { text: '✓ Approved! Money is on the way', tone: 'ok' },
  AI_FLAGGED: { text: 'An officer is double-checking your claim', tone: 'warn' },
  HUMAN_OVERRIDDEN: { text: 'An officer reviewed your claim', tone: 'warn' },
  PAID: { text: '✓ Money sent to your bank!', tone: 'ok' },
  REJECTED: { text: 'Claim could not be approved — visit your cooperative', tone: 'bad' },
};

const LOSS_TYPES = [
  { id: 'flood', icon: '🌊', label: 'Flood / Water' },
  { id: 'drought', icon: '☀️', label: 'Drought / Sun' },
  { id: 'livestock', icon: '🐄', label: 'Livestock' },
];

export default function FarmerPortal() {
  const qc = useQueryClient();
  const [name, setName] = useState('Ramesh Kumar');
  const [lossType, setLossType] = useState('flood');
  const [amount, setAmount] = useState(6500);
  const [photos, setPhotos] = useState(2);
  const [submitted, setSubmitted] = useState<string | null>(null);
  const [showScan, setShowScan] = useState(false);

  const claims = useQuery({ queryKey: ['claims'], queryFn: api.listClaims, refetchInterval: 5000 });
  const mine = (claims.data ?? []).filter((c) => c.claimantName === name.trim());

  const create = useMutation({
    mutationFn: () =>
      api.createClaim({
        claimantName: name.trim(),
        lossType,
        amountRequested: amount,
        imageHashes: Array.from({ length: photos }, (_, i) => `${lossType}-photo-${i + 1}-geotag`),
      }),
    onSuccess: (claim) => {
      qc.invalidateQueries({ queryKey: ['claims'] });
      qc.invalidateQueries({ queryKey: ['stats'] });
      qc.invalidateQueries({ queryKey: ['health'] });
      setSubmitted(claim.id);
    },
  });

  function submit() {
    setShowScan(true);
    setTimeout(() => {
      setShowScan(false);
      create.mutate();
    }, 3200);
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <OfflineBanner />
      <AiAnalysisOverlay active={showScan} />

      {/* Welcome banner */}
      <Card className="mb-4 overflow-hidden">
        <div className="bg-gradient-to-r from-status-ai/10 via-surface-card to-status-verified/10 p-5">
          <Chip tone="ok">Fast-Track Village Guarantee</Chip>
          <h1 className="mt-2 text-xl font-bold tracking-tight text-text-primary">
            Namaste, {name.trim() || 'Farmer'} 🙏
          </h1>
          <p className="mt-1 text-sm text-text-secondary">
            Just take photos of your field. No forms, no office visits — money comes straight to your bank.
          </p>
        </div>
      </Card>

      {/* New claim — big friendly targets */}
      <Card className="mb-4 p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-text-primary">What happened to your field?</h2>
          <Chip tone="ai">step 1 of 2</Chip>
        </div>

        <div className="mb-5 grid grid-cols-3 gap-3">
          {LOSS_TYPES.map((t) => (
            <button
              key={t.id}
              onClick={() => setLossType(t.id)}
              className={`flex h-24 flex-col items-center justify-center gap-2 rounded-xl border-2 transition-all ${
                lossType === t.id
                  ? 'border-status-verified bg-status-verified/10'
                  : 'border-border-subtle bg-surface-muted hover:border-border-strong'
              }`}
            >
              <span className="text-3xl">{t.icon}</span>
              <span className="text-xs font-semibold text-text-primary">{t.label}</span>
            </button>
          ))}
        </div>

        <label className="mb-1 block text-xs font-medium text-text-secondary">Your name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mb-4 w-full rounded-xl border border-border-subtle bg-surface-base px-4 py-3 text-base text-text-primary outline-none focus:border-status-verified"
        />

        <label className="mb-1 block text-xs font-medium text-text-secondary">How much loss (₹)?</label>
        <div className="mb-5 flex flex-wrap gap-2">
          {[2500, 4300, 6500, 9200].map((v) => (
            <button
              key={v}
              onClick={() => setAmount(v)}
              className={`rounded-xl border px-4 py-2.5 font-mono text-sm font-semibold ${
                amount === v
                  ? 'border-status-verified bg-status-verified/10 text-status-verified'
                  : 'border-border-subtle bg-surface-muted text-text-secondary'
              }`}
            >
              ₹{v.toLocaleString('en-IN')}
            </button>
          ))}
        </div>

        <label className="mb-1 block text-xs font-medium text-text-secondary">Take photos of the damage</label>
        <div className="mb-5 flex gap-3">
          {[1, 2, 3].map((n) => (
            <button
              key={n}
              onClick={() => setPhotos(n)}
              className={`flex h-16 flex-1 flex-col items-center justify-center rounded-xl border-2 gap-0.5 ${
                photos === n
                  ? 'border-status-verified bg-status-verified/10'
                  : 'border-border-subtle bg-surface-muted'
              }`}
            >
              <span className="text-xl">📷</span>
              <span className="text-xs font-semibold text-text-primary">{n} photo{n > 1 ? 's' : ''}</span>
            </button>
          ))}
        </div>

        <button
          disabled={create.isPending || showScan || !name.trim()}
          onClick={submit}
          className="h-14 w-full rounded-xl bg-status-verified text-base font-bold text-surface-base transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          📷 Submit My Claim
        </button>
        <p className="mt-2 text-center text-[11px] text-text-muted">
          GPS & time are added automatically · works offline · money via UPI
        </p>

        {create.isSuccess && submitted && (
          <div className="mt-4 rounded-xl border border-status-verified/40 bg-status-verified/10 p-4 text-center">
            <p className="text-sm font-semibold text-status-verified">✓ Claim {submitted} submitted!</p>
            <p className="mt-1 text-xs text-text-secondary">
              Sealed in the government-proof ledger. Track it below — no need to visit any office.
            </p>
          </div>
        )}
      </Card>

      {/* My claims — plain-language tracker */}
      <Card className="mb-4 p-5">
        <h2 className="mb-4 text-base font-semibold text-text-primary">My Claims</h2>
        {mine.length === 0 ? (
          <p className="py-4 text-center text-sm text-text-muted">
            No claims yet for “{name.trim() || '—'}”. Submit one above — it takes 2 minutes.
          </p>
        ) : (
          <div className="space-y-3">
            {mine.map((c) => {
              const st = PLAIN_STATUS[c.status] ?? PLAIN_STATUS.SUBMITTED;
              return (
                <div key={c.id} className="rounded-xl border border-border-subtle bg-surface-muted p-4">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs text-text-primary">{c.id}</span>
                    <Chip tone={st.tone}>{c.status}</Chip>
                  </div>
                  <p className="mt-2 text-sm font-medium text-text-primary">{st.text}</p>
                  <div className="mt-2 flex items-center justify-between text-xs text-text-muted">
                    <span>
                      {c.lossType} loss · {c.imageHashes.length} photo(s)
                    </span>
                    <span className="font-mono font-semibold text-text-secondary">₹{c.amountRequested.toLocaleString('en-IN')}</span>
                  </div>
                  {c.status === 'PAID' && (
                    <div className="mt-3 flex items-center gap-2 rounded-lg border border-status-verified/30 bg-status-verified/5 p-3">
                      <span className="text-lg">💰</span>
                      <div>
                        <p className="text-xs font-semibold text-status-verified">Sent to Bank of Maharashtra ••4810</p>
                        <p className="font-mono text-[10px] text-text-muted">UPI · Aadhaar-verified · sealed on-chain</p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Trust footer */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[11px] text-text-muted">
          <span>🔒 Photos sealed with bank-grade hash</span>
          <span>🏛️ Record kept in tamper-proof government ledger</span>
          <span>📶 Works without internet</span>
        </div>
      </Card>
    </main>
  );
}

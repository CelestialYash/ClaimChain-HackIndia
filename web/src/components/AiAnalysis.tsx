import { useEffect, useState } from 'react';

/**
 * AI-analysis showpiece: a forensic scan overlay that runs through staged
 * checks before revealing the decision. Purely presentational — the real
 * sealing still happens on-chain when the user confirms.
 */

const STEPS = [
  { label: 'Document AI — OCR extraction', detail: 'policy #, yield tables, bank passbook', ms: 700 },
  { label: 'Computer vision — damage assessment', detail: 'water level · vegetation stress index', ms: 900 },
  { label: 'Perceptual hash — duplicate check', detail: '8.4M archived images · 6 layers', ms: 800 },
  { label: 'Geo-fence & EXIF validation', detail: 'taluka rain gauge cross-check', ms: 600 },
];

export function useAiAnalysis(active: boolean) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!active) {
      setStep(0);
      return;
    }
    if (step >= STEPS.length) return;
    const t = setTimeout(() => setStep((s) => s + 1), STEPS[step].ms);
    return () => clearTimeout(t);
  }, [active, step]);

  const done = step >= STEPS.length;
  return { step, done };
}

export function AiAnalysisOverlay({ active }: { active: boolean }) {
  const { step, done } = useAiAnalysis(active);
  if (!active) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface-base/80 backdrop-blur-sm">
      <div className="w-[380px] rounded-lg border border-status-ai/40 bg-surface-card p-5 shadow-2xl shadow-status-ai/10">
        <div className="mb-4 flex items-center gap-2">
          <span className={`inline-block h-2 w-2 rounded-full bg-status-ai ${done ? '' : 'animate-pulse'}`} />
          <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-status-ai">
            {done ? 'analysis complete' : 'ai claims engine running'}
          </span>
        </div>

        <div className="space-y-2.5">
          {STEPS.map((s, i) => {
            const state = i < step ? 'done' : i === step ? 'running' : 'pending';
            return (
              <div key={s.label} className="flex items-start gap-2.5">
                <span
                  className={`mt-0.5 flex h-4 w-4 flex-none items-center justify-center rounded-full border font-mono text-[9px] ${
                    state === 'done'
                      ? 'border-status-verified/50 bg-status-verified/10 text-status-verified'
                      : state === 'running'
                        ? 'animate-pulse border-status-ai/50 bg-status-ai/10 text-status-ai'
                        : 'border-border-subtle text-text-muted'
                  }`}
                >
                  {state === 'done' ? '✓' : i + 1}
                </span>
                <div className="min-w-0">
                  <p className={`text-xs font-medium ${state === 'pending' ? 'text-text-muted' : 'text-text-primary'}`}>
                    {s.label}
                  </p>
                  {state !== 'pending' && (
                    <p className="font-mono text-[10px] text-text-muted">{s.detail}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-4 h-1 overflow-hidden rounded-full bg-surface-muted">
          <div
            className="h-full bg-status-ai transition-all duration-500"
            style={{ width: `${Math.min(100, (step / STEPS.length) * 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
}

import { NavLink } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

const TABS = [
  { to: '/', label: 'Command Center', key: '⌘' },
  { to: '/farmer', label: 'Farmer Portal', key: '🌾' },
  { to: '/auditor', label: 'Auditor', key: '🔍' },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const health = useQuery({ queryKey: ['health'], queryFn: api.health, refetchInterval: 5000 });
  const chainOk = health.data?.chain.enabled;

  return (
    <div className="min-h-screen bg-surface-base font-sans text-sm text-text-secondary">
      <header className="sticky top-0 z-30 border-b border-border-subtle bg-surface-base/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-status-ai/15">
                <span className="font-mono text-sm font-bold text-status-ai">⛓</span>
              </div>
              <div>
                <span className="block text-sm font-semibold tracking-tight text-text-primary">ClaimChain</span>
                <span className="block font-mono text-[9px] uppercase tracking-[0.2em] text-text-muted">
                  Enterprise Forensic Core
                </span>
              </div>
            </div>
            <nav className="ml-4 flex items-center gap-1">
              {TABS.map((t) => (
                <NavLink
                  key={t.to}
                  to={t.to}
                  className={({ isActive }) =>
                    `rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                      isActive
                        ? 'bg-surface-overlay text-status-ai'
                        : 'text-text-muted hover:bg-surface-card hover:text-text-primary'
                    }`
                  }
                >
                  <span className="mr-1.5">{t.key}</span>
                  {t.label}
                </NavLink>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3 font-mono text-[10px]">
            {chainOk ? <HealthChip ok /> : <HealthChip ok={false} />}
            <span className="hidden rounded border border-border-subtle bg-surface-card px-2 py-1 text-text-muted sm:block">
              records: <span className="text-status-ai">{health.data?.chain.totalRecords ?? '—'}</span>
            </span>
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}

function HealthChip({ ok }: { ok: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-widest ${
        ok
          ? 'border-status-verified/30 bg-status-verified/10 text-status-verified'
          : 'border-status-tamper/30 bg-status-tamper/10 text-status-tamper'
      }`}
    >
      <span className={`inline-block h-1.5 w-1.5 rounded-full ${ok ? 'bg-status-verified' : 'bg-status-tamper'}`} />
      {ok ? 'chain live' : 'chain offline'}
    </span>
  );
}

import { useEffect, useState } from 'react';
import { BudgetPanel } from './components/BudgetPanel';
import { ChecklistPanel } from './components/ChecklistPanel';
import { Conversation } from './components/Conversation';
import { IdeasPanel } from './components/IdeasPanel';
import { MiraAvatar } from './components/MiraAvatar';
import { TimelinePanel } from './components/TimelinePanel';
import { VendorsPanel } from './components/VendorsPanel';
import { useMira } from './lib/store';

interface Tab {
  id: string;
  label: string;
}

const TABS: Tab[] = [
  { id: 'plan', label: 'Plan' },
  { id: 'ideas', label: 'Ideas' },
  { id: 'budget', label: 'Budget' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'vendors', label: 'Vendors' },
  { id: 'checklist', label: 'Checklist' },
];

export default function App() {
  const { state, progress, timelineStats, resetAll, dispatch } = useMira();
  const [tab, setTab] = useState('plan');
  const [confirmReset, setConfirmReset] = useState(false);

  // Reflect provider availability in the header badge (never exposes secrets).
  useEffect(() => {
    let cancelled = false;
    fetch('/api/health')
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { aiConfigured?: boolean } | null) => {
        if (!cancelled && data && typeof data.aiConfigured === 'boolean') {
          dispatch({ type: 'set-ai-mode', mode: data.aiConfigured ? 'ai' : 'demo' });
        }
      })
      .catch(() => {
        if (!cancelled) dispatch({ type: 'set-ai-mode', mode: 'demo' });
      });
    return () => {
      cancelled = true;
    };
  }, [dispatch]);

  const counts: Record<string, string | null> = {
    ideas: state.concepts.length > 0 ? `${state.concepts.length}` : null,
    budget: state.budget ? '✓' : null,
    timeline: state.timeline.length > 0 ? `${timelineStats.done}/${timelineStats.total}` : null,
    checklist: state.checklist.length > 0 ? `${progress.percent}%` : null,
  };

  return (
    <div className="shell" data-testid="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>

      <header className="app-header">
        <div className="brand">
          <MiraAvatar />
          <div className="brand-text">
            <h1>Mira</h1>
            <span className="brand-tagline">Plan beautifully. Celebrate confidently.</span>
          </div>
        </div>
        <div className="header-tools">
          <span className="mode-badge" data-testid="mode-badge">
            {state.aiMode === 'ai' ? 'AI connected' : 'Demo mode · built-in planner'}
          </span>
          {confirmReset ? (
            <>
              <button
                className="btn btn-small btn-danger"
                data-testid="reset-confirm"
                onClick={() => {
                  resetAll();
                  setConfirmReset(false);
                  setTab('plan');
                }}
              >
                Yes, erase everything
              </button>
              <button className="btn btn-small btn-quiet" onClick={() => setConfirmReset(false)}>
                Cancel
              </button>
            </>
          ) : (
            <button
              className="btn btn-small btn-quiet"
              data-testid="reset-button"
              onClick={() => setConfirmReset(true)}
            >
              Reset data
            </button>
          )}
        </div>
      </header>

      <nav className="sidebar" aria-label="Planning sections">
        <ul className="nav-list">
          {TABS.map((entry) => (
            <li key={entry.id}>
              <button
                className="nav-button"
                data-testid={`nav-${entry.id}`}
                aria-current={tab === entry.id ? 'page' : undefined}
                onClick={() => setTab(entry.id)}
              >
                {entry.label}
                {counts[entry.id] && <span className="nav-count">{counts[entry.id]}</span>}
              </button>
            </li>
          ))}
        </ul>
        {state.profile && (
          <section aria-labelledby="sidebar-summary">
            <h2 id="sidebar-summary" className="section-label">
              Current event
            </h2>
            <p className="task-desc" data-testid="sidebar-event">
              <strong>{state.profile.title}</strong>
              <br />
              {state.profile.guestCount ?? '—'} guests ·{' '}
              {state.profile.budgetINR
                ? `${Math.round(state.profile.budgetINR / 1000)}k budget`
                : 'budget unset'}
            </p>
          </section>
        )}
      </nav>

      <main className="main" id="main-content" tabIndex={-1}>
        {tab === 'plan' && <Conversation onNavigate={setTab} />}
        {tab === 'ideas' && <IdeasPanel />}
        {tab === 'budget' && <BudgetPanel />}
        {tab === 'timeline' && <TimelinePanel />}
        {tab === 'vendors' && <VendorsPanel />}
        {tab === 'checklist' && <ChecklistPanel />}
      </main>
    </div>
  );
}

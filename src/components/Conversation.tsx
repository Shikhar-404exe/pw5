import { useEffect, useRef, useState } from 'react';
import { LIMITS, validateText } from '../lib/validation';
import { useMira } from '../lib/store';
import type { EventCategory } from '../types';
import { EventSummary } from './EventSummary';

const QUICK_PROMPTS: Array<{ label: string; message: string }> = [
  { label: 'Generate my plan', message: 'Generate my plan' },
  { label: 'Creative ideas', message: 'Suggest creative ideas for my event' },
  { label: 'Budget split', message: 'Build my budget' },
  { label: 'Timeline', message: 'Create my preparation timeline' },
  { label: 'Checklist', message: 'Make my checklist' },
  { label: 'Vendors', message: 'Which vendor categories do I need?' },
];

const EVENT_CHOICES: Array<{ category: EventCategory; label: string }> = [
  { category: 'wedding', label: 'Wedding' },
  { category: 'birthday', label: 'Birthday' },
  { category: 'community', label: 'Community event' },
];

export function Conversation({ onNavigate }: { onNavigate: (tab: string) => void }) {
  const { state, busy, sendMessage, createEvent, loadDemoScenario } = useMira();
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [state.messages.length, busy]);

  const submit = async (text: string) => {
    const trimmed = text.trim();
    const valid = validateText(trimmed, LIMITS.maxMessageLength, 'Message');
    if (!valid.ok) {
      setError(valid.errors[0] ?? 'Message is too long.');
      return;
    }
    setError(null);
    setDraft('');
    await sendMessage(trimmed);
  };

  return (
    <div className="panel">
      <div className="panel-header">
        <h2>Plan with Mira</h2>
        {busy && (
          <span className="mode-badge" role="status">
            <span className="spinner" aria-hidden="true" /> Thinking…
          </span>
        )}
      </div>
      <p className="panel-sub">
        Describe your celebration in your own words. Mira keeps the details and refines the plan
        with you.
      </p>

      <div className="plan-grid">
        <section className="surface" aria-labelledby="chat-heading">
          <h3 id="chat-heading" className="visually-hidden">
            Conversation with Mira
          </h3>

          {!state.profile && (
            <div className="empty" data-testid="no-event-empty">
              <h2>Start your celebration plan</h2>
              <p>Pick an event type, or simply describe it below — for example:</p>
              <p>
                <em>
                  “Wedding reception for 250 guests in Delhi, budget ₹12 lakh, modern elegant
                  theme.”
                </em>
              </p>
              <div className="choice-row">
                {EVENT_CHOICES.map((choice) => (
                  <button
                    key={choice.category}
                    className="btn"
                    data-testid={`event-type-${choice.category}`}
                    onClick={() => createEvent(choice.category)}
                  >
                    {choice.label}
                  </button>
                ))}
              </div>
              <div className="choice-row">
                <button
                  className="btn btn-quiet"
                  data-testid="demo-birthday"
                  onClick={() => loadDemoScenario('birthday')}
                >
                  Load birthday demo
                </button>
                <button
                  className="btn btn-quiet"
                  data-testid="demo-wedding"
                  onClick={() => loadDemoScenario('wedding')}
                >
                  Load wedding demo
                </button>
                <button
                  className="btn btn-quiet"
                  data-testid="demo-community"
                  onClick={() => loadDemoScenario('community')}
                >
                  Load community demo
                </button>
              </div>
            </div>
          )}

          <div
            className="chat-log"
            ref={logRef}
            data-testid="chat-messages"
            aria-live="polite"
            aria-relevant="additions"
          >
            {state.messages.map((message) => (
              <article
                key={message.id}
                className={`chat-msg ${message.role === 'user' ? 'user' : message.kind}`}
                data-testid={`chat-${message.role}`}
              >
                {message.role === 'mira' && <strong>Mira · </strong>}
                {message.text}
                {message.notes && message.notes.length > 0 && (
                  <ul className="chat-notes">
                    {message.notes.map((note) => (
                      <li key={note}>{note}</li>
                    ))}
                  </ul>
                )}
              </article>
            ))}
            {busy && (
              <p className="mode-badge" role="status">
                <span className="spinner" aria-hidden="true" /> Mira is thinking…
              </p>
            )}
            <div ref={endRef} />
          </div>

          <form
            className="chat-form"
            onSubmit={(event) => {
              event.preventDefault();
              void submit(draft);
            }}
          >
            <label htmlFor="chat-input" className="visually-hidden">
              Message Mira
            </label>
            <input
              id="chat-input"
              data-testid="chat-input"
              value={draft}
              maxLength={LIMITS.maxMessageLength}
              placeholder={
                state.budget
                  ? 'e.g. Reduce decoration and put more into photography'
                  : 'e.g. 120 guests, budget 5 lakh, on 14 February in Jaipur'
              }
              onChange={(event) => setDraft(event.target.value)}
              autoComplete="off"
            />
            <button
              type="submit"
              className="btn btn-primary"
              data-testid="chat-send"
              disabled={busy}
            >
              Send
            </button>
          </form>
          {error && (
            <p className="field-error" role="alert" data-testid="chat-error">
              {error}
            </p>
          )}

          {state.profile && (
            <div className="chip-row">
              {QUICK_PROMPTS.map((prompt) => (
                <button
                  key={prompt.label}
                  className="chip"
                  data-testid={`quick-${prompt.label.toLowerCase().replace(/\s+/g, '-')}`}
                  onClick={() => void submit(prompt.message)}
                  disabled={busy}
                >
                  {prompt.label}
                </button>
              ))}
              <button
                className="chip"
                data-testid="goto-budget"
                onClick={() => onNavigate('budget')}
              >
                Open budget →
              </button>
            </div>
          )}
        </section>

        {state.profile ? (
          <div>
            <EventSummary profile={state.profile} />
            <section className="surface" aria-labelledby="next-heading">
              <h2 id="next-heading">Suggested next step</h2>
              <p className="panel-sub" style={{ marginBottom: 8 }}>
                {state.budget
                  ? state.timeline.length > 0
                    ? 'Your plan is live — refine it any time by chatting on the left.'
                    : 'Generate the timeline to see dated preparation tasks.'
                  : 'Add a budget so Mira can build a realistic split.'}
              </p>
              <button
                className="btn btn-primary"
                data-testid="quick-generate-plan"
                onClick={() => void sendMessage('Generate my plan')}
                disabled={busy}
              >
                Generate my plan
              </button>
            </section>
          </div>
        ) : (
          <section className="surface" aria-labelledby="how-heading">
            <h2 id="how-heading">How Mira works</h2>
            <ol style={{ paddingLeft: 18, margin: '8px 0 0' }}>
              <li>Personalised ideas for your event type</li>
              <li>A deterministic, editable budget split</li>
              <li>A date-aware preparation timeline</li>
              <li>Vendor categories, organised and filterable</li>
              <li>An interactive checklist that persists</li>
            </ol>
          </section>
        )}
      </div>
    </div>
  );
}

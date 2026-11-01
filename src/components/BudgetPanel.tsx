import { useState } from 'react';
import { summarizeBudget, suggestReductions } from '../lib/budget';
import { formatINR, formatPercent } from '../lib/format';
import { useMira } from '../lib/store';
import { validateAllocation, validateBudget } from '../lib/validation';
import type { BudgetCategoryKey } from '../types';

export function BudgetPanel() {
  const { state, dispatch } = useMira();
  const [totalDraft, setTotalDraft] = useState('');
  const [totalError, setTotalError] = useState<string | null>(null);
  const [allocErrors, setAllocErrors] = useState<Record<string, string>>({});

  if (!state.profile) {
    return (
      <div className="panel">
        <h2>Smart budget</h2>
        <div className="empty" data-testid="budget-empty">
          <p>Create an event first — then Mira builds a deterministic budget split you can edit.</p>
        </div>
      </div>
    );
  }

  const profile = state.profile;

  if (!state.budget) {
    return (
      <div className="panel">
        <h2>Smart budget</h2>
        <p className="panel-sub">
          Enter your total budget and Mira will split it into practical categories. All maths is
          done in the app — never by the model.
        </p>
        <form
          className="surface form-row"
          onSubmit={(event) => {
            event.preventDefault();
            const parsed = validateBudget(totalDraft);
            if (!parsed.ok || parsed.value === null) {
              setTotalError(parsed.errors[0] ?? 'Invalid budget.');
              return;
            }
            setTotalError(null);
            dispatch({ type: 'retotal-budget', totalINR: parsed.value });
          }}
        >
          <div className="field">
            <label htmlFor="budget-total-input">Total budget (INR)</label>
            <input
              id="budget-total-input"
              data-testid="budget-total-input"
              type="number"
              min={1}
              value={totalDraft}
              onChange={(event) => setTotalDraft(event.target.value)}
              placeholder="e.g. 200000"
            />
          </div>
          <div className="field" style={{ justifyContent: 'flex-end' }}>
            <button type="submit" className="btn btn-primary" data-testid="budget-generate">
              Generate budget
            </button>
          </div>
          {totalError && (
            <p className="field-error" role="alert">
              {totalError}
            </p>
          )}
        </form>
      </div>
    );
  }

  const plan = state.budget;
  const summary = summarizeBudget(plan);
  const reductions = suggestReductions(plan, profile);
  const maxLine = Math.max(...plan.lines.map((line) => line.allocatedINR), 1);

  const commitAllocation = (key: BudgetCategoryKey, raw: string) => {
    const parsed = validateAllocation(raw, plan.totalINR);
    if (!parsed.ok || parsed.value === null) {
      setAllocErrors((previous) => ({ ...previous, [key]: parsed.errors[0] ?? 'Invalid amount.' }));
      return;
    }
    setAllocErrors((previous) => {
      const next = { ...previous };
      delete next[key];
      return next;
    });
    // Committing the value that is already there is not an edit: it must not
    // lock the line out of automatic rebalancing or suggestion lists.
    const current = plan.lines.find((line) => line.key === key)?.allocatedINR;
    if (parsed.value === current) return;
    dispatch({ type: 'set-allocation', key, amountINR: parsed.value });
  };

  return (
    <div className="panel">
      <div className="panel-header">
        <h2>Smart budget</h2>
        <button
          className="btn btn-quiet btn-small"
          data-testid="budget-reset"
          onClick={() => dispatch({ type: 'reset-budget' })}
        >
          Reset to suggested split
        </button>
      </div>
      <p className="panel-sub">
        Every amount below is an <strong>estimate</strong> until you confirm it with a vendor. You
        can edit any line — Mira recalculates instantly and never changes your total on its own.
      </p>

      <div className="summary-strip">
        <div className="summary-cell">
          <div className="label">Total budget</div>
          <div className="value" data-testid="budget-total">
            {formatINR(summary.totalINR)}
          </div>
        </div>
        <div className="summary-cell">
          <div className="label">Allocated</div>
          <div className="value" data-testid="budget-allocated">
            {formatINR(summary.allocatedINR)}
          </div>
        </div>
        <div className="summary-cell">
          <div className="label">Remaining</div>
          <div
            className="value"
            data-testid="budget-remaining"
            style={{ color: summary.remainingINR < 0 ? 'var(--danger)' : undefined }}
          >
            {formatINR(summary.remainingINR)}
          </div>
        </div>
        <div className="summary-cell">
          <div className="label">Benchmark estimate</div>
          <div className="value" data-testid="budget-estimated">
            {formatINR(summary.estimatedINR)}
          </div>
        </div>
        <div className="summary-cell">
          <div className="label">Variance (est. − allocated)</div>
          <div className="value" data-testid="budget-variance">
            {formatINR(summary.varianceINR)}
          </div>
        </div>
      </div>

      <form
        className="surface"
        onSubmit={(event) => event.preventDefault()}
        aria-labelledby="allocation-heading"
      >
        <h3 id="allocation-heading">Category allocations</h3>
        {plan.lines.map((line) => {
          const percent = summary.totalINR > 0 ? (line.allocatedINR / summary.totalINR) * 100 : 0;
          return (
            <div className="budget-row" key={line.key} data-testid={`budget-row-${line.key}`}>
              <div>
                <strong>{line.label}</strong>
                {line.userEdited && <span className="tag tag-demo"> edited</span>}
                <div className="task-desc">Estimate {formatINR(line.estimatedINR)}</div>
              </div>
              <div
                className="budget-bar"
                aria-hidden="true"
                data-testid={`budget-bar-${line.key}`}
                title={`${formatPercent(percent)} of total`}
              >
                <span style={{ width: `${Math.min(100, (line.allocatedINR / maxLine) * 100)}%` }} />
              </div>
              <div>
                <label htmlFor={`alloc-${line.key}`} className="visually-hidden">
                  {line.label} allocation in rupees
                </label>
                <input
                  id={`alloc-${line.key}`}
                  type="number"
                  min={0}
                  inputMode="numeric"
                  data-testid={`budget-allocation-${line.key}`}
                  defaultValue={line.allocatedINR}
                  key={`${line.key}-${line.allocatedINR}`}
                  onBlur={(event) => commitAllocation(line.key, event.target.value)}
                  aria-describedby={`alloc-pct-${line.key}`}
                />
                {allocErrors[line.key] && (
                  <span className="field-error" role="alert">
                    {allocErrors[line.key]}
                  </span>
                )}
              </div>
              <div
                className="budget-pct"
                id={`alloc-pct-${line.key}`}
                data-testid={`budget-pct-${line.key}`}
              >
                {formatPercent(percent)}
              </div>
            </div>
          );
        })}
      </form>

      <form
        className="surface form-row"
        onSubmit={(event) => {
          event.preventDefault();
          const parsed = validateBudget(totalDraft);
          if (!parsed.ok || parsed.value === null) {
            setTotalError(parsed.errors[0] ?? 'Invalid budget.');
            return;
          }
          setTotalError(null);
          dispatch({ type: 'retotal-budget', totalINR: parsed.value });
          setTotalDraft('');
        }}
      >
        <div className="field">
          <label htmlFor="budget-retotal">Change total budget (INR)</label>
          <input
            id="budget-retotal"
            type="number"
            min={1}
            value={totalDraft}
            onChange={(event) => setTotalDraft(event.target.value)}
            placeholder={String(plan.totalINR)}
          />
        </div>
        <div className="field" style={{ justifyContent: 'flex-end' }}>
          <button type="submit" className="btn" data-testid="budget-retotal-submit">
            Update total
          </button>
        </div>
        {totalError && (
          <p className="field-error" role="alert">
            {totalError}
          </p>
        )}
      </form>

      {summary.overBudget && (
        <div className="warn-box danger" role="alert" data-testid="budget-warning">
          <strong>Over budget by {formatINR(summary.overByINR)}.</strong> Your total budget has not
          been changed. Practical reductions:
          <ul className="suggestion-list">
            {reductions.map((suggestion) => (
              <li key={suggestion.key} data-testid={`reduction-${suggestion.key}`}>
                {suggestion.label}: reduce {formatINR(suggestion.currentINR)} →{' '}
                {formatINR(suggestion.suggestedINR)}{' '}
                <button
                  className="btn btn-small"
                  onClick={() =>
                    dispatch({
                      type: 'set-allocation',
                      key: suggestion.key,
                      amountINR: suggestion.suggestedINR,
                    })
                  }
                >
                  Apply
                </button>
              </li>
            ))}
            {reductions.length === 0 && <li>Trim any edited line to come back under budget.</li>}
          </ul>
        </div>
      )}

      {!summary.overBudget && summary.varianceINR > 0 && (
        <div className="warn-box" role="status" data-testid="budget-variance-warning">
          <strong>Heads up:</strong> benchmark estimates run {formatINR(summary.varianceINR)} above
          your current allocation. These are indicative figures, not confirmed vendor prices.
        </div>
      )}
    </div>
  );
}

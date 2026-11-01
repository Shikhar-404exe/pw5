import { useState } from 'react';
import { checklistProgress, groupBySection } from '../lib/checklist';
import { formatDate, formatPercent } from '../lib/format';
import { useMira } from '../lib/store';
import { LIMITS, validateText } from '../lib/validation';
import type { ChecklistItem } from '../types';

export function ChecklistPanel() {
  const { state, dispatch } = useMira();
  const [newTitle, setNewTitle] = useState('');
  const [newSection, setNewSection] = useState('Mine');
  const [newPriority, setNewPriority] = useState<ChecklistItem['priority']>('medium');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!state.profile) {
    return (
      <div className="panel">
        <h2>Event checklist</h2>
        <div className="empty" data-testid="checklist-empty">
          <p>Create an event to build a personalised, persistent checklist.</p>
        </div>
      </div>
    );
  }

  if (state.checklist.length === 0) {
    return (
      <div className="panel">
        <h2>Event checklist</h2>
        <div className="empty" data-testid="checklist-empty">
          <p>No checklist yet for this event.</p>
          <button
            className="btn btn-primary"
            data-testid="checklist-generate"
            onClick={() => dispatch({ type: 'generate', options: { checklist: true } })}
          >
            Generate checklist
          </button>
        </div>
      </div>
    );
  }

  const progress = checklistProgress(state.checklist);
  const groups = groupBySection(state.checklist);

  const addItem = (event: React.FormEvent) => {
    event.preventDefault();
    const valid = validateText(newTitle, LIMITS.maxTaskTitleLength, 'Task');
    if (!valid.ok || valid.value === null) {
      setError(valid.errors[0] ?? 'Invalid task.');
      return;
    }
    setError(null);
    dispatch({
      type: 'checklist-add',
      title: valid.value,
      section: newSection,
      priority: newPriority,
    });
    setNewTitle('');
  };

  return (
    <div className="panel">
      <h2>Event checklist</h2>
      <p className="panel-sub">Progress saves instantly on this device.</p>

      <section className="surface" aria-labelledby="progress-heading">
        <h3 id="progress-heading">
          Progress:{' '}
          <span data-testid="checklist-progress-percent">{formatPercent(progress.percent)}</span>{' '}
          <span className="mode-badge">
            {progress.done}/{progress.total} done
          </span>
        </h3>
        <div
          className="progress-track"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress.percent}
          aria-labelledby="progress-heading"
          data-testid="checklist-progress"
        >
          <span className="progress-fill" style={{ width: `${progress.percent}%` }} />
        </div>
      </section>

      {groups.map((group) => (
        <section key={group.section}>
          <h3 className="section-label">{group.section}</h3>
          <ul className="check-list surface" data-testid={`checklist-group-${group.section}`}>
            {group.items.map((item) => {
              const editing = editingId === item.id;
              return (
                <li
                  className={`check-item ${item.status}`}
                  key={item.id}
                  data-testid={`checklist-item-${item.id}`}
                >
                  <input
                    type="checkbox"
                    checked={item.status === 'done'}
                    data-testid={`checklist-toggle-${item.id}`}
                    aria-label={`Mark ${item.title} as ${item.status === 'done' ? 'not done' : 'done'}`}
                    onChange={() => dispatch({ type: 'checklist-toggle', id: item.id })}
                  />
                  <div className="check-body">
                    {editing ? (
                      <form
                        onSubmit={(event) => {
                          event.preventDefault();
                          const valid = validateText(editTitle, LIMITS.maxTaskTitleLength, 'Task');
                          if (valid.ok && valid.value) {
                            dispatch({
                              type: 'checklist-update',
                              id: item.id,
                              patch: { title: valid.value },
                            });
                            setEditingId(null);
                          }
                        }}
                      >
                        <label htmlFor={`check-edit-${item.id}`} className="visually-hidden">
                          Edit checklist item
                        </label>
                        <input
                          id={`check-edit-${item.id}`}
                          value={editTitle}
                          onChange={(event) => setEditTitle(event.target.value)}
                          style={{ width: '100%' }}
                        />
                        <button type="submit" className="btn btn-small">
                          Save
                        </button>
                      </form>
                    ) : (
                      <div className="check-title">{item.title}</div>
                    )}
                    <div className="task-meta">
                      <span>{formatDate(item.dueDate)}</span>
                      <span>· {item.relativeLabel}</span>
                      <span className={`tag tag-${item.priority}`}>{item.priority}</span>
                      {item.status === 'done' && <span className="tag tag-ok">✓ Done</span>}
                    </div>
                  </div>
                  <div className="task-actions">
                    <button
                      className="btn btn-small"
                      data-testid={`checklist-edit-${item.id}`}
                      onClick={() => {
                        setEditingId(item.id);
                        setEditTitle(item.title);
                      }}
                    >
                      Edit
                    </button>
                    <button
                      className="btn btn-small btn-danger"
                      data-testid={`checklist-delete-${item.id}`}
                      onClick={() => dispatch({ type: 'checklist-delete', id: item.id })}
                    >
                      Delete
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      <form className="surface form-row" onSubmit={addItem} aria-labelledby="add-check-heading">
        <h3 id="add-check-heading" style={{ gridColumn: '1 / -1' }}>
          Add a checklist item
        </h3>
        <div className="field">
          <label htmlFor="checklist-add-title">Task</label>
          <input
            id="checklist-add-title"
            data-testid="checklist-add-title"
            value={newTitle}
            maxLength={LIMITS.maxTaskTitleLength}
            onChange={(event) => setNewTitle(event.target.value)}
            placeholder="e.g. Book mehendi artist"
          />
        </div>
        <div className="field">
          <label htmlFor="checklist-add-section">Group</label>
          <input
            id="checklist-add-section"
            data-testid="checklist-add-section"
            value={newSection}
            maxLength={40}
            onChange={(event) => setNewSection(event.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="checklist-add-priority">Priority</label>
          <select
            id="checklist-add-priority"
            data-testid="checklist-add-priority"
            value={newPriority}
            onChange={(event) => setNewPriority(event.target.value as ChecklistItem['priority'])}
          >
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
        <div className="field" style={{ justifyContent: 'flex-end' }}>
          <button type="submit" className="btn" data-testid="checklist-add-submit">
            Add item
          </button>
        </div>
        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}
      </form>
    </div>
  );
}

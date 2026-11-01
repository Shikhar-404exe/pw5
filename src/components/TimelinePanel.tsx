import { useState } from 'react';
import { formatDate } from '../lib/format';
import { isOverdue } from '../lib/timeline';
import { useMira } from '../lib/store';
import { LIMITS, validateText } from '../lib/validation';
import type { TimelineTask } from '../types';

type Filter = 'all' | 'pending' | 'done';

export function TimelinePanel() {
  const { state, dispatch, timelineStats } = useMira();
  const [filter, setFilter] = useState<Filter>('all');
  const [descending, setDescending] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newDate, setNewDate] = useState('');
  const [newPriority, setNewPriority] = useState<TimelineTask['priority']>('medium');
  const [formError, setFormError] = useState<string | null>(null);

  if (!state.profile) {
    return (
      <div className="panel">
        <h2>Preparation timeline</h2>
        <div className="empty" data-testid="timeline-empty">
          <p>Create an event to generate a date-aware preparation timeline.</p>
        </div>
      </div>
    );
  }

  const visible = state.timeline
    .filter((task) => (filter === 'all' ? true : task.status === filter))
    .sort((a, b) => {
      const factor = descending ? -1 : 1;
      const aKey = a.dueDate ?? `9999-${a.offsetDays}`;
      const bKey = b.dueDate ?? `9999-${b.offsetDays}`;
      return factor * aKey.localeCompare(bKey);
    });

  const addTask = (event: React.FormEvent) => {
    event.preventDefault();
    const valid = validateText(newTitle, LIMITS.maxTaskTitleLength, 'Task title');
    if (!valid.ok || valid.value === null) {
      setFormError(valid.errors[0] ?? 'Invalid task.');
      return;
    }
    setFormError(null);
    dispatch({
      type: 'timeline-add',
      title: valid.value,
      description: 'Added by you.',
      dueDate: newDate === '' ? null : newDate,
      priority: newPriority,
    });
    setNewTitle('');
    setNewDate('');
    setNewPriority('medium');
  };

  return (
    <div className="panel">
      <div className="panel-header">
        <h2>Preparation timeline</h2>
        <p className="mode-badge" data-testid="timeline-overdue-count">
          {timelineStats.overdue} overdue · {timelineStats.done}/{timelineStats.total} done
        </p>
      </div>
      <p className="panel-sub">
        Milestones are compressed to fit your real runway, so Mira never invents impossible lead
        times.
        {state.profile.eventDate === null && ' No date set — this schedule is relative.'}
      </p>

      {state.timeline.length === 0 ? (
        <div className="empty" data-testid="timeline-empty">
          <p>No timeline yet for this event.</p>
          <button
            className="btn btn-primary"
            data-testid="timeline-generate"
            onClick={() => dispatch({ type: 'generate', options: { timeline: true } })}
          >
            Generate timeline
          </button>
        </div>
      ) : (
        <>
          <div className="surface">
            <div className="filter-row" style={{ marginBottom: 0 }}>
              <div className="field">
                <label htmlFor="timeline-filter">Filter</label>
                <select
                  id="timeline-filter"
                  data-testid="timeline-filter"
                  value={filter}
                  onChange={(event) => setFilter(event.target.value as Filter)}
                >
                  <option value="all">All tasks</option>
                  <option value="pending">Pending</option>
                  <option value="done">Completed</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="timeline-sort">Sort by deadline</label>
                <select
                  id="timeline-sort"
                  data-testid="timeline-sort"
                  value={descending ? 'desc' : 'asc'}
                  onChange={(event) => setDescending(event.target.value === 'desc')}
                >
                  <option value="asc">Soonest first</option>
                  <option value="desc">Latest first</option>
                </select>
              </div>
            </div>
          </div>

          <ul className="task-list surface" data-testid="timeline-list">
            {visible.map((task) => {
              const overdue = isOverdue(task);
              const editing = editingId === task.id;
              return (
                <li
                  className={`task-item ${task.status}`}
                  key={task.id}
                  data-testid={`timeline-item-${task.id}`}
                >
                  <input
                    type="checkbox"
                    checked={task.status === 'done'}
                    data-testid={`timeline-toggle-${task.id}`}
                    aria-label={`Mark ${task.title} as ${task.status === 'done' ? 'pending' : 'complete'}`}
                    onChange={() => dispatch({ type: 'timeline-toggle', id: task.id })}
                  />
                  <div className="task-body">
                    {editing ? (
                      <form
                        onSubmit={(event) => {
                          event.preventDefault();
                          const valid = validateText(
                            editTitle,
                            LIMITS.maxTaskTitleLength,
                            'Task title',
                          );
                          if (valid.ok && valid.value) {
                            dispatch({
                              type: 'timeline-update',
                              id: task.id,
                              patch: { title: valid.value },
                            });
                            setEditingId(null);
                          }
                        }}
                      >
                        <label htmlFor={`edit-${task.id}`} className="visually-hidden">
                          Edit task title
                        </label>
                        <input
                          id={`edit-${task.id}`}
                          value={editTitle}
                          onChange={(event) => setEditTitle(event.target.value)}
                          style={{ width: '100%' }}
                        />
                        <button type="submit" className="btn btn-small">
                          Save
                        </button>
                      </form>
                    ) : (
                      <div className="task-title">{task.title}</div>
                    )}
                    <p className="task-desc">{task.description}</p>
                    <div className="task-meta">
                      <span>{formatDate(task.dueDate)}</span>
                      <span>· {task.relativeLabel}</span>
                      <span className={`tag tag-${task.priority}`}>{task.priority}</span>
                      {overdue && (
                        <span className="tag tag-danger" data-testid={`overdue-${task.id}`}>
                          ⚠ Overdue
                        </span>
                      )}
                      {task.status === 'done' && <span className="tag tag-ok">✓ Done</span>}
                    </div>
                  </div>
                  <div className="task-actions">
                    <button
                      className="btn btn-small"
                      data-testid={`timeline-edit-${task.id}`}
                      onClick={() => {
                        setEditingId(task.id);
                        setEditTitle(task.title);
                      }}
                    >
                      Edit
                    </button>
                    <button
                      className="btn btn-small btn-danger"
                      data-testid={`timeline-delete-${task.id}`}
                      onClick={() => dispatch({ type: 'timeline-delete', id: task.id })}
                    >
                      Delete
                    </button>
                  </div>
                </li>
              );
            })}
            {visible.length === 0 && <li className="task-item">No tasks match this filter.</li>}
          </ul>

          <form className="surface form-row" onSubmit={addTask} aria-labelledby="add-task-heading">
            <h3 id="add-task-heading" style={{ gridColumn: '1 / -1' }}>
              Add a task
            </h3>
            <div className="field">
              <label htmlFor="timeline-add-title">Task</label>
              <input
                id="timeline-add-title"
                data-testid="timeline-add-title"
                value={newTitle}
                maxLength={LIMITS.maxTaskTitleLength}
                onChange={(event) => setNewTitle(event.target.value)}
                placeholder="e.g. Confirm DJ playlist"
              />
            </div>
            <div className="field">
              <label htmlFor="timeline-add-date">Due date</label>
              <input
                id="timeline-add-date"
                type="date"
                data-testid="timeline-add-date"
                value={newDate}
                onChange={(event) => setNewDate(event.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="timeline-add-priority">Priority</label>
              <select
                id="timeline-add-priority"
                data-testid="timeline-add-priority"
                value={newPriority}
                onChange={(event) => setNewPriority(event.target.value as TimelineTask['priority'])}
              >
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
            <div className="field" style={{ justifyContent: 'flex-end' }}>
              <button type="submit" className="btn" data-testid="timeline-add-submit">
                Add task
              </button>
            </div>
            {formError && (
              <p className="field-error" role="alert">
                {formError}
              </p>
            )}
          </form>
        </>
      )}
    </div>
  );
}

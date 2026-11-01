import { useState } from 'react';
import { useMira } from '../lib/store';
import type { EventConcept } from '../types';

function ConceptCard({ concept }: { concept: EventConcept }) {
  const { dispatch } = useMira();
  return (
    <article
      className={`concept-card ${concept.status}`}
      data-testid={`concept-card-${concept.id}`}
      aria-labelledby={`concept-title-${concept.id}`}
    >
      <div className="panel-header">
        <h3 id={`concept-title-${concept.id}`}>{concept.title}</h3>
        <span
          className={`tag ${concept.source === 'ai' ? 'tag-demo' : ''}`}
          data-testid={`concept-source-${concept.id}`}
        >
          {concept.source === 'ai' ? 'AI suggestion' : 'Demo suggestion'}
        </span>
      </div>
      <p style={{ margin: '6px 0 0' }}>{concept.description}</p>

      <div className="palette-row" aria-label={`Colour palette: ${concept.palette.join(', ')}`}>
        {concept.palette.map((color) => (
          <span
            key={color}
            className="palette-swatch"
            style={{ backgroundColor: color }}
            aria-hidden="true"
          />
        ))}
        <span className="task-desc">Palette: {concept.palette.join(' · ')}</span>
      </div>

      <div className="concept-cols">
        <div>
          <strong>Theme</strong>
          <p className="task-desc">{concept.theme}</p>
        </div>
        <div>
          <strong>Decoration</strong>
          <ul>
            {concept.decorations.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
        <div>
          <strong>Food</strong>
          <ul>
            {concept.food.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
        <div>
          <strong>Entertainment</strong>
          <ul>
            {concept.entertainment.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </div>

      <p className="task-desc" style={{ marginTop: 10 }}>
        <strong>Budget implication:</strong> {concept.budgetImplication} (estimate)
      </p>
      <p className="task-desc">
        <strong>Good to know:</strong> {concept.considerations.join(' · ')}
      </p>

      <div className="concept-actions">
        <button
          className="btn btn-small btn-primary"
          data-testid={`concept-accept-${concept.id}`}
          aria-pressed={concept.status === 'accepted'}
          onClick={() => dispatch({ type: 'concept-status', id: concept.id, status: 'accepted' })}
        >
          {concept.status === 'accepted' ? '✓ Accepted' : 'Accept'}
        </button>
        <button
          className="btn btn-small"
          data-testid={`concept-reject-${concept.id}`}
          onClick={() => dispatch({ type: 'concept-status', id: concept.id, status: 'rejected' })}
        >
          Reject
        </button>
        <button
          className="btn btn-small btn-quiet"
          data-testid={`concept-refine-${concept.id}`}
          onClick={() => dispatch({ type: 'refine-concept', id: concept.id })}
        >
          Refresh with my theme
        </button>
      </div>
    </article>
  );
}

export function IdeasPanel() {
  const { state, dispatch } = useMira();
  const [showRejected, setShowRejected] = useState(false);

  if (!state.profile) {
    return (
      <div className="panel">
        <h2>Personalised ideas</h2>
        <div className="empty" data-testid="ideas-empty">
          <p>
            Create an event and Mira will propose concepts tailored to your guests, budget and
            style.
          </p>
        </div>
      </div>
    );
  }

  const visible = state.concepts.filter((concept) =>
    showRejected ? true : concept.status !== 'rejected',
  );

  return (
    <div className="panel">
      <div className="panel-header">
        <h2>Personalised ideas</h2>
        <button
          className="btn btn-quiet btn-small"
          data-testid="ideas-regenerate"
          onClick={() => dispatch({ type: 'generate', options: { ideas: true } })}
        >
          Refresh ideas
        </button>
      </div>
      <p className="panel-sub">
        Concepts are generated from your event type, guest count, budget, location and theme.
        Rejected ideas are never suggested again.
      </p>

      {visible.length === 0 ? (
        <div className="empty" data-testid="ideas-empty">
          <p>No concepts yet — ask Mira for ideas, or refresh above.</p>
        </div>
      ) : (
        visible.map((concept) => <ConceptCard key={concept.id} concept={concept} />)
      )}

      <div className="chip-row">
        <button
          className="chip"
          data-testid="ideas-toggle-rejected"
          aria-pressed={showRejected}
          onClick={() => setShowRejected((value) => !value)}
        >
          {showRejected
            ? 'Hide rejected ideas'
            : `Show rejected (${state.concepts.filter((c) => c.status === 'rejected').length})`}
        </button>
      </div>
    </div>
  );
}

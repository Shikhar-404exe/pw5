import { useEffect, useState } from 'react';
import type { EventProfile } from '../types';
import { formatDate } from '../lib/format';
import { useMira } from '../lib/store';

interface FieldProps {
  label: string;
  id: string;
  type: 'text' | 'number' | 'date';
  value: string;
  placeholder?: string;
  onCommit: (value: string) => void;
}

/** A single editable summary field. Commits on blur/Enter so typing stays cheap. */
function SummaryField({ label, id, type, value, placeholder, onCommit }: FieldProps) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        data-testid={id}
        type={type}
        value={draft}
        placeholder={placeholder}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => draft !== value && onCommit(draft)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') (event.target as HTMLInputElement).blur();
        }}
      />
    </div>
  );
}

export function EventSummary({ profile }: { profile: EventProfile }) {
  const { patchProfile } = useMira();

  const numberOrNull = (raw: string): number | null => {
    const digits = raw.replace(/[^\d]/g, '');
    return digits.length > 0 ? Number(digits) : null;
  };

  return (
    <section className="surface" aria-labelledby="summary-heading">
      <h2 id="summary-heading">Event summary</h2>
      <p className="panel-sub">
        <span className="tag">{profile.category}</span> {profile.title}
      </p>
      <div className="form-row" style={{ marginBottom: 10 }}>
        <SummaryField
          label="Guests"
          id="field-guests"
          type="number"
          value={profile.guestCount?.toString() ?? ''}
          placeholder="e.g. 120"
          onCommit={(raw) => patchProfile({ guestCount: numberOrNull(raw) })}
        />
        <SummaryField
          label="Budget (INR)"
          id="field-budget"
          type="number"
          value={profile.budgetINR?.toString() ?? ''}
          placeholder="e.g. 200000"
          onCommit={(raw) => patchProfile({ budgetINR: numberOrNull(raw) })}
        />
      </div>
      <div className="form-row" style={{ marginBottom: 10 }}>
        <SummaryField
          label="Date"
          id="field-date"
          type="date"
          value={profile.eventDate ?? ''}
          onCommit={(raw) => patchProfile({ eventDate: raw === '' ? null : raw })}
        />
        <SummaryField
          label="Location"
          id="field-location"
          type="text"
          value={profile.location ?? ''}
          placeholder="e.g. Delhi"
          onCommit={(raw) => patchProfile({ location: raw === '' ? null : raw })}
        />
      </div>
      <SummaryField
        label="Theme"
        id="field-theme"
        type="text"
        value={profile.theme ?? ''}
        placeholder="e.g. modern elegant"
        onCommit={(raw) => patchProfile({ theme: raw === '' ? null : raw })}
      />
      <p className="panel-sub" style={{ marginTop: 12, marginBottom: 0 }}>
        Date shown: <strong>{formatDate(profile.eventDate)}</strong>
      </p>
    </section>
  );
}

import { useMemo, useState } from 'react';
import { formatINRCompact } from '../lib/format';
import { useMira } from '../lib/store';
import {
  SAMPLE_VENDORS,
  VENDOR_CATEGORY_LABELS,
  filterVendors,
  vendorLocations,
} from '../lib/vendors';
import type { Vendor, VendorCategory, VendorFilters } from '../types';

const CATEGORY_OPTIONS = Object.entries(VENDOR_CATEGORY_LABELS) as Array<[VendorCategory, string]>;

export function VendorsPanel() {
  const { state, dispatch } = useMira();
  const [category, setCategory] = useState<VendorFilters['category']>('all');
  const [location, setLocation] = useState<string>('all');
  const [maxBudget, setMaxBudget] = useState('');
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [contacted, setContacted] = useState<string[]>([]);

  const locations = useMemo(() => vendorLocations(SAMPLE_VENDORS), []);

  const filters: VendorFilters = useMemo(() => {
    const digits = maxBudget.replace(/[^\d]/g, '');
    return {
      category,
      location,
      maxBudgetINR: digits.length > 0 ? Number(digits) : null,
      minRating: null,
    };
  }, [category, location, maxBudget]);

  const results = filterVendors(SAMPLE_VENDORS, filters);

  return (
    <div className="panel">
      <div className="panel-header">
        <h2>Vendor discovery</h2>
        <span className="tag tag-demo" data-testid="vendor-sample-notice">
          Demonstration samples — not real businesses
        </span>
      </div>
      <p className="panel-sub">
        No vendor-search provider is configured for this build, so every entry below is a clearly
        labelled sample. No ratings, prices or availability are claimed as real. Shortlisting and
        contacting always require your confirmation.
      </p>

      <section className="surface" aria-labelledby="vendor-filters-heading">
        <h3 id="vendor-filters-heading">Filters</h3>
        <div className="filter-row">
          <div className="field">
            <label htmlFor="vendor-filter-category">Category</label>
            <select
              id="vendor-filter-category"
              data-testid="vendor-filter-category"
              value={category}
              onChange={(event) => setCategory(event.target.value as VendorFilters['category'])}
            >
              <option value="all">All categories</option>
              {CATEGORY_OPTIONS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="vendor-filter-location">Location</label>
            <select
              id="vendor-filter-location"
              data-testid="vendor-filter-location"
              value={location}
              onChange={(event) => setLocation(event.target.value)}
            >
              <option value="all">All locations</option>
              {locations.map((entry) => (
                <option key={entry} value={entry}>
                  {entry}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="vendor-filter-budget">Max price (INR)</label>
            <input
              id="vendor-filter-budget"
              type="number"
              min={0}
              data-testid="vendor-filter-budget"
              value={maxBudget}
              onChange={(event) => setMaxBudget(event.target.value)}
              placeholder="Any"
            />
          </div>
        </div>
        <p className="mode-badge" data-testid="vendor-result-count">
          {results.length} sample vendor{results.length === 1 ? '' : 's'}
        </p>
      </section>

      <div role="list" aria-label="Sample vendors">
        {results.map((vendor: Vendor) => {
          const shortlisted = state.shortlist.includes(vendor.id);
          const isConfirming = confirmingId === vendor.id;
          const wasContacted = contacted.includes(vendor.id);
          return (
            <article
              className="vendor-card"
              key={vendor.id}
              data-testid={`vendor-card-${vendor.id}`}
            >
              <div className="vendor-info">
                <h3>
                  {vendor.name}{' '}
                  <span className="tag tag-demo" data-testid="vendor-sample-badge">
                    sample
                  </span>
                </h3>
                <p style={{ margin: '4px 0 0' }}>{vendor.description}</p>
                <div className="vendor-meta">
                  <span className="tag">{VENDOR_CATEGORY_LABELS[vendor.category]}</span>
                  <span>{vendor.location}</span>
                  {vendor.priceRangeLabel && <span>{vendor.priceRangeLabel}</span>}
                  <span>Rating: not available (sample)</span>
                  <span className="tag tag-warn">Verification: sample data</span>
                </div>
              </div>
              <div className="vendor-actions">
                <button
                  className="btn btn-small"
                  data-testid={`vendor-shortlist-${vendor.id}`}
                  aria-pressed={shortlisted}
                  onClick={() => dispatch({ type: 'shortlist-toggle', id: vendor.id })}
                >
                  {shortlisted ? '★ Shortlisted' : '☆ Shortlist'}
                </button>
                {wasContacted ? (
                  <span className="tag tag-ok" data-testid={`vendor-contacted-${vendor.id}`}>
                    Request noted (demo)
                  </span>
                ) : isConfirming ? (
                  <>
                    <button
                      className="btn btn-small btn-primary"
                      data-testid={`vendor-confirm-${vendor.id}`}
                      onClick={() => {
                        setContacted((previous) => [...previous, vendor.id]);
                        setConfirmingId(null);
                      }}
                    >
                      Yes, request contact
                    </button>
                    <button
                      className="btn btn-small btn-quiet"
                      onClick={() => setConfirmingId(null)}
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <button
                    className="btn btn-small"
                    data-testid={`vendor-contact-${vendor.id}`}
                    onClick={() => setConfirmingId(vendor.id)}
                  >
                    Request contact
                  </button>
                )}
                <span className="task-desc">
                  Price shown: {vendor.priceRangeLabel ? 'estimated (sample)' : 'not available'}
                </span>
              </div>
            </article>
          );
        })}
        {results.length === 0 && (
          <div className="empty" data-testid="vendors-no-results">
            <p>No sample vendors match these filters — try widening the budget or category.</p>
          </div>
        )}
      </div>

      {state.shortlist.length > 0 && (
        <section className="surface" aria-labelledby="shortlist-heading">
          <h3 id="shortlist-heading">
            Your shortlist ({state.shortlist.length}) — estimated sample ranges
          </h3>
          <ul className="suggestion-list" data-testid="vendor-shortlist">
            {state.shortlist.map((id) => {
              const vendor = SAMPLE_VENDORS.find((entry) => entry.id === id);
              if (!vendor) return null;
              return (
                <li key={id}>
                  {vendor.name} · {VENDOR_CATEGORY_LABELS[vendor.category]} ·{' '}
                  {vendor.priceRangeLabel ?? 'estimate unavailable'}
                  {vendor.priceMinINR !== null &&
                    vendor.priceMaxINR !== null &&
                    ` (${formatINRCompact(vendor.priceMinINR)}–${formatINRCompact(vendor.priceMaxINR)})`}
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}

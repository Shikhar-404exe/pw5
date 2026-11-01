/** Formatting helpers shared across the UI. */

const inrFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

export function formatINR(amount: number): string {
  if (!Number.isFinite(amount)) return '—';
  return inrFormatter.format(Math.round(amount));
}

/** Compact form for tight spaces: ₹1.2L, ₹85k, ₹4,500. */
export function formatINRCompact(amount: number): string {
  if (!Number.isFinite(amount)) return '—';
  const abs = Math.abs(amount);
  if (abs >= 100_000_000) return `₹${(amount / 100_000_000).toFixed(1)}Cr`;
  if (abs >= 100_000) return `₹${(amount / 100_000).toFixed(1)}L`;
  if (abs >= 1_000) return `₹${Math.round(amount / 1_000)}k`;
  return inrFormatter.format(Math.round(amount));
}

const dateFormatter = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

export function formatDate(iso: string | null): string {
  if (!iso) return 'Not set';
  const date = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(date.getTime())) return 'Not set';
  return dateFormatter.format(date);
}

export function formatPercent(value: number): string {
  if (!Number.isFinite(value)) return '0%';
  return `${Math.round(value)}%`;
}

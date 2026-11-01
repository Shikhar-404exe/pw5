/**
 * Deterministic budget engine.
 * All money maths happens here in whole rupees - never in the AI layer.
 */

import type {
  BudgetCategoryKey,
  BudgetLine,
  BudgetPlan,
  BudgetSummary,
  EventCategory,
  EventProfile,
  Priority,
} from '../types';
import { clampInt } from './validation';

export const BUDGET_LABELS: Record<BudgetCategoryKey, string> = {
  venue: 'Venue',
  catering: 'Catering',
  decoration: 'Decoration',
  photography: 'Photography',
  clothing: 'Clothing & styling',
  entertainment: 'Entertainment',
  invitations: 'Invitations',
  transport: 'Transportation',
  cake: 'Cake & desserts',
  permissions: 'Permissions & permits',
  equipment: 'Equipment & rentals',
  publicity: 'Publicity',
  logistics: 'Logistics',
  misc: 'Miscellaneous',
};

export const CATEGORY_SETS: Record<EventCategory, BudgetCategoryKey[]> = {
  wedding: [
    'venue',
    'catering',
    'decoration',
    'photography',
    'clothing',
    'entertainment',
    'invitations',
    'transport',
    'misc',
  ],
  birthday: ['venue', 'catering', 'decoration', 'cake', 'entertainment', 'photography', 'misc'],
  community: [
    'venue',
    'permissions',
    'equipment',
    'catering',
    'publicity',
    'entertainment',
    'logistics',
    'misc',
  ],
};

/** Base share of the total budget, before priority weighting. Sums to 1 per category. */
const BASE_WEIGHTS: Record<EventCategory, Partial<Record<BudgetCategoryKey, number>>> = {
  wedding: {
    venue: 0.18,
    catering: 0.3,
    decoration: 0.13,
    photography: 0.1,
    clothing: 0.1,
    entertainment: 0.07,
    invitations: 0.03,
    transport: 0.04,
    misc: 0.05,
  },
  birthday: {
    venue: 0.2,
    catering: 0.28,
    decoration: 0.14,
    cake: 0.08,
    entertainment: 0.14,
    photography: 0.08,
    misc: 0.08,
  },
  community: {
    venue: 0.16,
    permissions: 0.06,
    equipment: 0.18,
    catering: 0.22,
    publicity: 0.1,
    entertainment: 0.12,
    logistics: 0.1,
    misc: 0.06,
  },
};

const PRIORITY_MULTIPLIER: Record<Priority, number> = { high: 1.35, medium: 1, low: 0.7 };

/** Rough location cost index applied to venue/catering benchmarks. */
const CITY_INDEX: Record<string, number> = {
  mumbai: 1.25,
  delhi: 1.15,
  'new delhi': 1.15,
  bangalore: 1.15,
  bengaluru: 1.15,
  hyderabad: 1.1,
  chennai: 1.05,
  pune: 1.05,
  kolkata: 1.0,
  ahmedabad: 0.95,
  jaipur: 0.95,
  lucknow: 0.9,
  indore: 0.85,
  goa: 1.2,
};

export function locationIndex(location: string | null): number {
  if (!location) return 1;
  const key = location.trim().toLowerCase();
  return CITY_INDEX[key] ?? 1.05;
}

export function priorityFor(profile: EventProfile, key: BudgetCategoryKey): Priority {
  return profile.priorities[key] ?? 'medium';
}

/**
 * Largest-remainder distribution so that line amounts always sum to exactly the total.
 */
export function distribute(totalINR: number, weights: number[]): number[] {
  const safeTotal = Math.max(0, Math.round(totalINR));
  const weightSum = weights.reduce((sum, w) => sum + Math.max(0, w), 0);
  if (weightSum <= 0 || safeTotal === 0) return weights.map(() => 0);
  const raw = weights.map((w) => (safeTotal * Math.max(0, w)) / weightSum);
  const floors = raw.map((value) => Math.floor(value));
  let remainder = safeTotal - floors.reduce((sum, v) => sum + v, 0);
  const order = raw
    .map((value, index) => ({ index, frac: value - Math.floor(value) }))
    .sort((a, b) => b.frac - a.frac || a.index - b.index);
  for (const entry of order) {
    if (remainder <= 0) break;
    floors[entry.index] = (floors[entry.index] ?? 0) + 1;
    remainder -= 1;
  }
  return floors;
}

/** Benchmark estimate for a line. Clearly an estimate - never a confirmed price. */
function estimateFor(
  key: BudgetCategoryKey,
  allocatedINR: number,
  guests: number,
  index: number,
): number {
  if (key === 'catering' && guests > 0) return Math.round(guests * 850 * index);
  if (key === 'venue' && guests > 0) return Math.round(guests * 350 * index);
  if (key === 'cake' && guests > 0) return Math.round(guests * 120);
  return allocatedINR;
}

/** Build a fresh, fully deterministic budget plan from the event profile. */
export function createBudgetPlan(profile: EventProfile): BudgetPlan | null {
  if (profile.budgetINR === null || profile.budgetINR <= 0) return null;
  const keys = CATEGORY_SETS[profile.category];
  const weights = keys.map((key) => {
    const base = BASE_WEIGHTS[profile.category][key] ?? 0.05;
    return base * PRIORITY_MULTIPLIER[priorityFor(profile, key)];
  });
  const amounts = distribute(profile.budgetINR, weights);
  const guests = profile.guestCount ?? 0;
  const index = locationIndex(profile.location);
  const lines: BudgetLine[] = keys.map((key, position) => {
    const allocatedINR = amounts[position] ?? 0;
    return {
      key,
      label: BUDGET_LABELS[key],
      allocatedINR,
      estimatedINR: estimateFor(key, allocatedINR, guests, index),
      isEstimate: true,
      userEdited: false,
    };
  });
  return { totalINR: profile.budgetINR, lines };
}

/** Change the total without discarding user edits: keep edited shares, re-derive the rest. */
export function retotalBudget(plan: BudgetPlan, newTotalINR: number): BudgetPlan {
  const total = Math.max(0, Math.round(newTotalINR));
  const edited = plan.lines.filter((line) => line.userEdited);
  const editable = plan.lines.filter((line) => !line.userEdited);
  const editedSum = edited.reduce((sum, line) => sum + line.allocatedINR, 0);
  const remainingPool = Math.max(0, total - editedSum);
  const oldEditableSum = editable.reduce((sum, line) => sum + line.allocatedINR, 0);
  const shares =
    oldEditableSum > 0
      ? editable.map((line) => line.allocatedINR / oldEditableSum)
      : editable.map(() => 1 / Math.max(1, editable.length));
  const amounts = distribute(remainingPool, shares);
  let amountIndex = 0;
  const lines = plan.lines.map((line) => {
    if (line.userEdited) return { ...line };
    const allocatedINR = amounts[amountIndex] ?? 0;
    amountIndex += 1;
    return { ...line, allocatedINR };
  });
  return { totalINR: total, lines };
}

/** Edit one allocation. The engine never silently changes the user's total budget. */
export function setAllocation(
  plan: BudgetPlan,
  key: BudgetCategoryKey,
  amountINR: number,
): BudgetPlan {
  const safeAmount = clampInt(amountINR, 0, Number.MAX_SAFE_INTEGER);
  const lines = plan.lines.map((line) =>
    line.key === key ? { ...line, allocatedINR: safeAmount, userEdited: true } : line,
  );
  return { ...plan, lines };
}

/**
 * Re-derive the automatic lines after priorities change.
 * User-edited lines are preserved exactly; the rest follow the new weights.
 */
export function rebalanceBudget(plan: BudgetPlan, profile: EventProfile): BudgetPlan {
  const edited = plan.lines.filter((line) => line.userEdited);
  const editable = plan.lines.filter((line) => !line.userEdited);
  const editedSum = edited.reduce((sum, line) => sum + line.allocatedINR, 0);
  const pool = Math.max(0, plan.totalINR - editedSum);
  const weights = editable.map(
    (line) =>
      (BASE_WEIGHTS[profile.category][line.key] ?? 0.05) *
      PRIORITY_MULTIPLIER[priorityFor(profile, line.key)],
  );
  const amounts = distribute(pool, weights);
  let amountIndex = 0;
  const lines = plan.lines.map((line) => {
    if (line.userEdited) return { ...line };
    const allocatedINR = amounts[amountIndex] ?? 0;
    amountIndex += 1;
    return { ...line, allocatedINR };
  });
  return { ...plan, lines };
}

export function summarizeBudget(plan: BudgetPlan): BudgetSummary {
  const allocatedINR = plan.lines.reduce((sum, line) => sum + line.allocatedINR, 0);
  const estimatedINR = plan.lines.reduce((sum, line) => sum + line.estimatedINR, 0);
  const remainingINR = plan.totalINR - allocatedINR;
  const varianceINR = estimatedINR - allocatedINR;
  const overByINR = Math.max(0, allocatedINR - plan.totalINR);
  return {
    totalINR: plan.totalINR,
    allocatedINR,
    estimatedINR,
    remainingINR,
    varianceINR,
    overBudget: overByINR > 0,
    overByINR,
    percentAllocated: plan.totalINR > 0 ? (allocatedINR / plan.totalINR) * 100 : 0,
  };
}

export interface ReductionSuggestion {
  key: BudgetCategoryKey;
  label: string;
  currentINR: number;
  suggestedINR: number;
}

/**
 * Practical cost reductions when allocations exceed the budget.
 * Suggests trimming the least prioritised, non-user-edited lines first.
 */
export function suggestReductions(plan: BudgetPlan, profile: EventProfile): ReductionSuggestion[] {
  const summary = summarizeBudget(plan);
  if (!summary.overBudget) return [];
  const rank: Record<Priority, number> = { low: 0, medium: 1, high: 2 };
  const candidates = plan.lines
    .filter((line) => !line.userEdited && line.allocatedINR > 0)
    .sort((a, b) => rank[priorityFor(profile, a.key)] - rank[priorityFor(profile, b.key)]);
  const fallback = plan.lines
    .filter((line) => line.allocatedINR > 0)
    .sort((a, b) => rank[priorityFor(profile, a.key)] - rank[priorityFor(profile, b.key)]);
  const pool = candidates.length > 0 ? candidates : fallback;
  let needed = summary.overByINR;
  const suggestions: ReductionSuggestion[] = [];
  for (const line of pool) {
    if (needed <= 0) break;
    const cut = Math.min(line.allocatedINR, Math.ceil(needed * 0.6));
    suggestions.push({
      key: line.key,
      label: line.label,
      currentINR: line.allocatedINR,
      suggestedINR: line.allocatedINR - cut,
    });
    needed -= cut;
  }
  return suggestions;
}

export function perGuestBudget(profile: EventProfile): number | null {
  if (profile.budgetINR === null || !profile.guestCount) return null;
  return Math.round(profile.budgetINR / profile.guestCount);
}

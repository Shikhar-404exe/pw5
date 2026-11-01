import { describe, expect, it } from 'vitest';
import {
  CATEGORY_SETS,
  createBudgetPlan,
  distribute,
  locationIndex,
  perGuestBudget,
  rebalanceBudget,
  retotalBudget,
  setAllocation,
  summarizeBudget,
  suggestReductions,
} from '../../src/lib/budget';
import type { EventProfile, Priority } from '../../src/types';

function profile(overrides: Partial<EventProfile> = {}): EventProfile {
  return {
    category: 'wedding',
    title: 'Test wedding',
    guestCount: 100,
    budgetINR: 1_000_000,
    location: 'Delhi',
    eventDate: '2026-12-01',
    theme: 'modern',
    audience: null,
    priorities: {},
    ...overrides,
  };
}

describe('distribute', () => {
  it('always sums exactly to the total', () => {
    const amounts = distribute(1_000_000, [3, 2, 1, 1, 1, 1, 1, 1, 1]);
    expect(amounts.reduce((sum, value) => sum + value, 0)).toBe(1_000_000);
  });

  it('handles awkward remainders without losing or inventing rupees', () => {
    const amounts = distribute(100, [1, 1, 1]);
    expect(amounts.reduce((sum, value) => sum + value, 0)).toBe(100);
    expect(amounts).toEqual([34, 33, 33]);
  });

  it('returns zeros for a zero budget or zero weights', () => {
    expect(distribute(0, [1, 2])).toEqual([0, 0]);
    expect(distribute(500, [0, 0])).toEqual([0, 0]);
  });
});

describe('createBudgetPlan', () => {
  it('allocates exactly the total budget across the category set', () => {
    const plan = createBudgetPlan(profile());
    expect(plan).not.toBeNull();
    const total = plan!.lines.reduce((sum, line) => sum + line.allocatedINR, 0);
    expect(total).toBe(1_000_000);
    expect(plan!.lines.map((line) => line.key)).toEqual(CATEGORY_SETS.wedding);
  });

  it('returns null without a budget', () => {
    expect(createBudgetPlan(profile({ budgetINR: null }))).toBeNull();
    expect(createBudgetPlan(profile({ budgetINR: 0 }))).toBeNull();
  });

  it('weights high-priority categories above low-priority ones', () => {
    const priorities: Partial<Record<string, Priority>> = { catering: 'high', decoration: 'low' };
    const plan = createBudgetPlan(profile({ priorities }))!;
    const catering = plan.lines.find((line) => line.key === 'catering')!;
    const decoration = plan.lines.find((line) => line.key === 'decoration')!;
    expect(catering.allocatedINR).toBeGreaterThan(decoration.allocatedINR * 2);
  });

  it('marks every line as an estimate', () => {
    const plan = createBudgetPlan(profile())!;
    expect(plan.lines.every((line) => line.isEstimate)).toBe(true);
  });

  it('produces category sets for all three event types', () => {
    expect(CATEGORY_SETS.birthday).toContain('cake');
    expect(CATEGORY_SETS.community).toContain('permissions');
    for (const category of ['wedding', 'birthday', 'community'] as const) {
      const plan = createBudgetPlan(profile({ category, budgetINR: 20_000 }))!;
      const sum = plan.lines.reduce((total, line) => total + line.allocatedINR, 0);
      expect(sum).toBe(20_000);
    }
  });
});

describe('summarizeBudget', () => {
  it('computes remaining, variance and percentages', () => {
    const plan = createBudgetPlan(profile())!;
    const summary = summarizeBudget(plan);
    expect(summary.allocatedINR).toBe(1_000_000);
    expect(summary.remainingINR).toBe(0);
    expect(summary.percentAllocated).toBe(100);
    expect(summary.overBudget).toBe(false);
    expect(summary.varianceINR).toBe(summary.estimatedINR - summary.allocatedINR);
  });

  it('flags over-budget allocations', () => {
    const plan = createBudgetPlan(profile())!;
    const inflated = setAllocation(plan, 'venue', 2_000_000);
    const summary = summarizeBudget(inflated);
    expect(summary.overBudget).toBe(true);
    expect(summary.overByINR).toBeGreaterThan(0);
    expect(summary.remainingINR).toBeLessThan(0);
  });

  it('survives a zero-total budget', () => {
    const plan = { totalINR: 0, lines: [] };
    const summary = summarizeBudget(plan);
    expect(summary.percentAllocated).toBe(0);
    expect(summary.remainingINR).toBe(0);
  });
});

describe('setAllocation', () => {
  it('marks the line as user edited and leaves the total untouched', () => {
    const plan = createBudgetPlan(profile())!;
    const updated = setAllocation(plan, 'decoration', 50_000);
    const line = updated.lines.find((entry) => entry.key === 'decoration')!;
    expect(line.allocatedINR).toBe(50_000);
    expect(line.userEdited).toBe(true);
    expect(updated.totalINR).toBe(plan.totalINR);
  });

  it('clamps negatives to zero', () => {
    const plan = createBudgetPlan(profile())!;
    const updated = setAllocation(plan, 'venue', -500);
    expect(updated.lines.find((entry) => entry.key === 'venue')!.allocatedINR).toBe(0);
  });

  it('handles decimal input by rounding', () => {
    const plan = createBudgetPlan(profile())!;
    const updated = setAllocation(plan, 'venue', 12_345.6);
    expect(updated.lines.find((entry) => entry.key === 'venue')!.allocatedINR).toBe(12_346);
  });
});

describe('retotalBudget', () => {
  it('scales automatic lines when the total changes and preserves edits', () => {
    const plan = setAllocation(
      createBudgetPlan(profile())!,
      'cake' in {} ? 'venue' : 'venue',
      100_000,
    );
    const updated = retotalBudget(plan, 2_000_000);
    expect(updated.totalINR).toBe(2_000_000);
    expect(updated.lines.find((line) => line.key === 'venue')!.allocatedINR).toBe(100_000);
    const editedSum = updated.lines
      .filter((line) => line.userEdited)
      .reduce((sum, line) => sum + line.allocatedINR, 0);
    const autoSum = updated.lines
      .filter((line) => !line.userEdited)
      .reduce((sum, line) => sum + line.allocatedINR, 0);
    expect(editedSum + autoSum).toBe(2_000_000);
  });

  it('never silently reverts to a different total', () => {
    const plan = createBudgetPlan(profile())!;
    const updated = retotalBudget(plan, 500_000);
    expect(summarizeBudget(updated).totalINR).toBe(500_000);
  });
});

describe('rebalanceBudget', () => {
  it('keeps edited lines and moves money toward new priorities', () => {
    const plan = setAllocation(createBudgetPlan(profile())!, 'photography', 100_000);
    const editedBefore = plan.lines.find((line) => line.key === 'photography')!.allocatedINR;
    const updated = rebalanceBudget(
      plan,
      profile({ priorities: { catering: 'high', decoration: 'low' } }),
    );
    expect(updated.lines.find((line) => line.key === 'photography')!.allocatedINR).toBe(
      editedBefore,
    );
    const catering = updated.lines.find((line) => line.key === 'catering')!;
    const decoration = updated.lines.find((line) => line.key === 'decoration')!;
    expect(catering.allocatedINR).toBeGreaterThan(decoration.allocatedINR);
    expect(updated.lines.reduce((sum, line) => sum + line.allocatedINR, 0)).toBe(updated.totalINR);
  });
});

describe('suggestReductions', () => {
  it('returns nothing when under budget', () => {
    const plan = createBudgetPlan(profile())!;
    expect(suggestReductions(plan, profile())).toEqual([]);
  });

  it('suggests trims that cover the overflow', () => {
    const plan = setAllocation(createBudgetPlan(profile())!, 'venue', 1_500_000);
    const suggestions = suggestReductions(plan, profile({ priorities: { venue: 'low' } }));
    expect(suggestions.length).toBeGreaterThan(0);
    const totalCut = suggestions.reduce(
      (sum, entry) => sum + (entry.currentINR - entry.suggestedINR),
      0,
    );
    expect(totalCut).toBeGreaterThan(0);
    expect(suggestions.every((entry) => entry.suggestedINR >= 0)).toBe(true);
  });
});

describe('locationIndex / perGuestBudget', () => {
  it('applies a cost index for known cities and a default otherwise', () => {
    expect(locationIndex('Mumbai')).toBeGreaterThan(1);
    expect(locationIndex('Nowhere')).toBe(1.05);
    expect(locationIndex(null)).toBe(1);
  });

  it('computes per-guest budget only with both values', () => {
    expect(perGuestBudget(profile())).toBe(10_000);
    expect(perGuestBudget(profile({ guestCount: null }))).toBeNull();
    expect(perGuestBudget(profile({ budgetINR: null }))).toBeNull();
  });
});

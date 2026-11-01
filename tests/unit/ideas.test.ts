import { describe, expect, it } from 'vitest';
import { conceptId, generateConcepts, refineConcept } from '../../src/lib/ideas';
import { createBudgetPlan } from '../../src/lib/budget';
import type { EventProfile } from '../../src/types';

function profile(overrides: Partial<EventProfile> = {}): EventProfile {
  return {
    category: 'wedding',
    title: 'Test wedding',
    guestCount: 150,
    budgetINR: 800_000,
    location: 'Delhi',
    eventDate: '2026-12-01',
    theme: 'modern elegant',
    audience: null,
    priorities: {},
    ...overrides,
  };
}

describe('generateConcepts', () => {
  it('produces three complete concepts for each category', () => {
    for (const category of ['wedding', 'birthday', 'community'] as const) {
      const concepts = generateConcepts(profile({ category }), null);
      expect(concepts).toHaveLength(3);
      for (const concept of concepts) {
        expect(concept.title.length).toBeGreaterThan(3);
        expect(concept.palette.length).toBeGreaterThanOrEqual(3);
        expect(concept.decorations.length).toBeGreaterThan(0);
        expect(concept.food.length).toBeGreaterThan(0);
        expect(concept.entertainment.length).toBeGreaterThan(0);
        expect(concept.budgetImplication.length).toBeGreaterThan(0);
        expect(concept.considerations.length).toBeGreaterThan(0);
        expect(concept.source).toBe('demo');
        expect(concept.status).toBe('suggested');
        expect(concept.id.startsWith(category)).toBe(true);
      }
    }
  });

  it('is deterministic for identical input', () => {
    const first = generateConcepts(profile(), null).map((concept) => concept.id);
    const second = generateConcepts(profile(), null).map((concept) => concept.id);
    expect(first).toEqual(second);
  });

  it('mentions budget scale when a plan is supplied', () => {
    const plan = createBudgetPlan(profile())!;
    const concepts = generateConcepts(profile(), plan);
    expect(concepts[0]!.budgetImplication).toMatch(/guests/);
  });

  it('adapts palettes to the theme', () => {
    const modern = generateConcepts(profile({ theme: 'modern elegant' }), null)[0]!;
    const festive = generateConcepts(profile({ theme: 'festive colours' }), null)[0]!;
    expect(modern.palette).not.toEqual(festive.palette);
  });
});

describe('conceptId / refineConcept', () => {
  it('builds stable ids and refreshes a concept with the current theme', () => {
    expect(conceptId(profile(), 'x')).toBe('wedding-x');
    const concept = generateConcepts(profile(), null)[0]!;
    const refined = refineConcept(concept, profile({ theme: 'sustainable eco friendly' }), null);
    expect(refined.theme).toContain('sustainable');
    expect(refined.palette).not.toEqual(concept.palette);
  });
});

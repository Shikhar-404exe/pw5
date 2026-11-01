import { describe, expect, it } from 'vitest';
import {
  buildLocalTurn,
  defaultTitle,
  detectCategory,
  detectIntents,
  matchCategoryKey,
  missingEssentials,
  parseAudience,
  parseBudgetINR,
  parseEventDate,
  parseGuestCount,
  parseLocation,
  parsePriorityChanges,
  parseTheme,
} from '../../src/lib/localPlanner';
import type { EventProfile } from '../../src/types';

function profile(overrides: Partial<EventProfile> = {}): EventProfile {
  return {
    category: 'wedding',
    title: 'Wedding',
    guestCount: null,
    budgetINR: null,
    location: null,
    eventDate: null,
    theme: null,
    audience: null,
    priorities: {},
    ...overrides,
  };
}

const today = new Date('2026-06-01T00:00:00Z');

describe('detectCategory', () => {
  it('recognises the three supported categories', () => {
    expect(detectCategory('I want a wedding reception')).toBe('wedding');
    expect(detectCategory('my shaadi next month')).toBe('wedding');
    expect(detectCategory('birthday party for my son')).toBe('birthday');
    expect(detectCategory('a community fundraiser in the park')).toBe('community');
    expect(detectCategory('just planning something')).toBeNull();
  });
});

describe('parseGuestCount', () => {
  it('reads common phrasings', () => {
    expect(parseGuestCount('about 120 guests')).toBe(120);
    expect(parseGuestCount('guest count of 250')).toBe(250);
    expect(parseGuestCount('we expect 40 people')).toBe(40);
    expect(parseGuestCount('no idea yet')).toBeNull();
  });
});

describe('parseBudgetINR', () => {
  it('reads plain rupee amounts', () => {
    expect(parseBudgetINR('budget 20000')).toBe(20_000);
    expect(parseBudgetINR('₹20,000')).toBe(20_000);
    expect(parseBudgetINR('Rs. 150000')).toBe(150_000);
  });

  it('reads lakh, thousand and crore units', () => {
    expect(parseBudgetINR('budget of 12 lakh')).toBe(1_200_000);
    expect(parseBudgetINR('1.5 lakh budget')).toBe(150_000);
    expect(parseBudgetINR('₹2 crore')).toBe(20_000_000);
    expect(parseBudgetINR('around 300k')).toBe(300_000);
  });

  it('does not confuse guest counts with budgets', () => {
    expect(parseBudgetINR('around 120 guests')).toBeNull();
  });

  it('returns null when no budget is mentioned', () => {
    expect(parseBudgetINR('just a small party')).toBeNull();
  });
});

describe('parseEventDate', () => {
  it('reads ISO dates', () => {
    expect(parseEventDate('on 2026-12-05', today)).toBe('2026-12-05');
  });

  it('reads named dates and rolls into next year when needed', () => {
    expect(parseEventDate('on 5 December 2026', today)).toBe('2026-12-05');
    expect(parseEventDate('on 15 January', today)).toBe('2027-01-15');
    expect(parseEventDate('on 4 July', today)).toBe('2026-07-04');
  });

  it('reads relative windows', () => {
    expect(parseEventDate('in 30 days', today)).toBe('2026-07-01');
    expect(parseEventDate('in 2 weeks', today)).toBe('2026-06-15');
    expect(parseEventDate('next month', today)).toBe('2026-07-01');
  });

  it('returns null when undated', () => {
    expect(parseEventDate('sometime soon', today)).toBeNull();
  });
});

describe('parseLocation', () => {
  it('finds known cities', () => {
    expect(parseLocation('in Delhi with 100 guests')).toBe('Delhi');
    expect(parseLocation('venue in bengaluru')).toBe('Bengaluru');
  });

  it('returns null when absent', () => {
    expect(parseLocation('at my house')).toBeNull();
  });
});

describe('parseTheme', () => {
  it('reads labelled themes', () => {
    expect(parseTheme('theme of rustic farmhouse')).toBe('rustic farmhouse');
  });

  it('detects known style words', () => {
    expect(parseTheme('something minimalist and clean')).toContain('minimalist');
    expect(parseTheme('a royal affair')).toContain('luxury');
  });

  it('returns null without a theme', () => {
    expect(parseTheme('no clue about style')).toBeNull();
  });
});

describe('parseAudience', () => {
  it('captures age groups', () => {
    expect(parseAudience('for 8 year olds')).toBe('8 year olds');
    expect(parseAudience('for the kids')).toBe('kids');
    expect(parseAudience('college students')).toBe('college students');
  });
});

describe('parsePriorityChanges', () => {
  it('understands reduce-and-increase refinements', () => {
    const changes = parsePriorityChanges('Reduce decoration and allocate more to photography');
    expect(changes.decoration).toBe('low');
    expect(changes.photography).toBe('high');
  });

  it('handles single-sided changes', () => {
    expect(parsePriorityChanges('cut the catering cost').catering).toBe('low');
    expect(parsePriorityChanges('increase entertainment').entertainment).toBe('high');
  });

  it('returns nothing for unrelated messages', () => {
    expect(parsePriorityChanges('hello there')).toEqual({});
  });
});

describe('matchCategoryKey', () => {
  it('maps phrases to budget keys', () => {
    expect(matchCategoryKey('the cake budget')).toBe('cake');
    expect(matchCategoryKey('sound and lighting rentals')).toBe('equipment');
    expect(matchCategoryKey('something unrecognisable')).toBeNull();
  });
});

describe('detectIntents', () => {
  it('detects full-plan requests', () => {
    expect(detectIntents('generate my plan').wantsAll).toBe(true);
    const intents = detectIntents('build my budget');
    expect(intents.wantsBudget).toBe(true);
    expect(intents.wantsAll).toBe(false);
  });
});

describe('buildLocalTurn', () => {
  it('extracts a complete profile from one message', () => {
    const turn = buildLocalTurn(
      'Wedding reception for 250 guests in Delhi, budget ₹12 lakh, theme modern elegant, on 5 December 2026',
      profile({ category: 'birthday' }),
      today,
    );
    expect(turn.delta.category).toBe('wedding');
    expect(turn.delta.guestCount).toBe(250);
    expect(turn.delta.budgetINR).toBe(1_200_000);
    expect(turn.delta.location).toBe('Delhi');
    expect(turn.delta.theme).toContain('modern');
    expect(turn.delta.eventDate).toBe('2026-12-05');
  });

  it('preserves context: unmentioned fields stay untouched', () => {
    const existing = profile({
      guestCount: 250,
      budgetINR: 1_200_000,
      location: 'Delhi',
      eventDate: '2026-12-05',
      theme: 'modern elegant',
    });
    const turn = buildLocalTurn('Change the theme to rustic', existing, today);
    expect(turn.delta.theme).toBe('rustic');
    expect(turn.delta.guestCount).toBeUndefined();
    expect(turn.delta.budgetINR).toBeUndefined();
    expect(turn.delta.eventDate).toBeUndefined();
    expect(turn.delta.location).toBeUndefined();
  });

  it('asks for missing essentials', () => {
    const turn = buildLocalTurn('I want a birthday party', profile(), today);
    expect(turn.questions.length).toBeGreaterThan(0);
    expect(turn.questions.join(' ')).toMatch(/guests/i);
  });

  it('applies priority refinements', () => {
    const turn = buildLocalTurn(
      'Reduce decoration and allocate more to photography',
      profile({ budgetINR: 500_000, guestCount: 100, eventDate: '2026-12-01' }),
      today,
    );
    expect(turn.priorityChanges.decoration).toBe('low');
    expect(turn.priorityChanges.photography).toBe('high');
  });
});

describe('missingEssentials / defaultTitle', () => {
  it('lists missing items and stops at three questions', () => {
    const questions = missingEssentials(profile());
    expect(questions.length).toBeLessThanOrEqual(3);
    expect(
      missingEssentials(
        profile({
          guestCount: 10,
          budgetINR: 100,
          eventDate: '2026-12-01',
          location: 'Delhi',
          theme: 'x',
        }),
      ),
    ).toEqual([]);
  });

  it('builds a sensible default title', () => {
    expect(defaultTitle(profile({ category: 'birthday', location: 'Pune' }))).toBe(
      'Birthday in Pune',
    );
  });
});

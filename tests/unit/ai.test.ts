import { describe, expect, it, vi } from 'vitest';
import { extractJson, parseAiTurn, planTurn, aiTurnSchema } from '../../src/lib/ai';
import type { EventProfile } from '../../src/types';

function profile(overrides: Partial<EventProfile> = {}): EventProfile {
  return {
    category: 'wedding',
    title: 'Test wedding',
    guestCount: 100,
    budgetINR: 1_000_000,
    location: 'Delhi',
    eventDate: null,
    theme: null,
    audience: null,
    priorities: {},
    ...overrides,
  };
}

const validTurn = {
  reply: 'Here is a plan for your wedding.',
  questions: ['What is your date?'],
  profile: { theme: 'rustic' },
  priorityChanges: { decoration: 'low' },
  concepts: [
    {
      title: 'Rustic Courtyard Evening',
      description: 'A warm courtyard celebration with long tables and lanterns.',
      theme: 'rustic',
      palette: ['#4E6A50', '#B98B5E', '#EDE7D9'],
      decorations: ['Lantern strings', 'Wildflower jars'],
      food: ['Sharing platters', 'Chai station'],
      entertainment: ['Acoustic duo'],
      budgetImplication: 'Slightly above average decor spend.',
      considerations: ['Confirm outdoor backup'],
    },
  ],
};

describe('extractJson', () => {
  it('parses plain and fenced JSON', () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 });
    expect(extractJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
  });

  it('throws on garbage', () => {
    expect(() => extractJson('not json')).toThrow();
  });
});

describe('parseAiTurn', () => {
  it('accepts a well-formed model response', () => {
    const { data, error } = parseAiTurn(JSON.stringify(validTurn));
    expect(error).toBeNull();
    expect(data?.reply).toContain('wedding');
    expect(data?.concepts).toHaveLength(1);
  });

  it('reports unreadable output safely', () => {
    const { data, error } = parseAiTurn('<html>oops</html>');
    expect(data).toBeNull();
    expect(error).toMatch(/unreadable/i);
  });

  it('rejects malformed structured output (wrong shape)', () => {
    const { data, error } = parseAiTurn(JSON.stringify({ reply: 42, questions: 'yes' }));
    expect(data).toBeNull();
    expect(error).toMatch(/unexpected/i);
  });

  it('rejects out-of-range values from the model', () => {
    const bad = { ...validTurn, profile: { guestCount: 999_999 } };
    expect(parseAiTurn(JSON.stringify(bad)).data).toBeNull();
    const badDate = { ...validTurn, profile: { eventDate: '2026-99-99' } };
    expect(parseAiTurn(JSON.stringify(badDate)).data).toBeNull();
  });

  it('rejects invalid palette colours', () => {
    const bad = {
      ...validTurn,
      concepts: [{ ...validTurn.concepts[0], palette: ['javascript:alert(1)'] }],
    };
    expect(parseAiTurn(JSON.stringify(bad)).data).toBeNull();
  });

  it('defaults questions when omitted', () => {
    const { data } = parseAiTurn(JSON.stringify({ reply: 'Hello there, friend!' }));
    expect(data?.questions).toEqual([]);
  });
});

describe('aiTurnSchema', () => {
  it('enforces priority vocabulary', () => {
    expect(
      aiTurnSchema.safeParse({ reply: 'hi', priorityChanges: { venue: 'urgent' } }).success,
    ).toBe(false);
    expect(
      aiTurnSchema.safeParse({ reply: 'hi', priorityChanges: { venue: 'high' } }).success,
    ).toBe(true);
  });
});

describe('planTurn', () => {
  it('falls back to the local planner when the provider is not configured (503)', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(new Response('{"error":"ai_not_configured"}', { status: 503 }));
    const result = await planTurn(
      'Birthday for 30 guests, budget 20000',
      profile({ category: 'birthday', guestCount: null, budgetINR: null }),
      {
        fetchImpl: fetchImpl as unknown as typeof fetch,
        history: [],
      },
    );
    expect(result.mode).toBe('demo');
    expect(result.notice).toMatch(/demo mode/i);
    expect(result.delta.guestCount).toBe(30);
    expect(result.delta.budgetINR).toBe(20_000);
  });

  it('uses validated AI output when the provider responds correctly', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ text: JSON.stringify(validTurn) }), { status: 200 }),
      );
    const result = await planTurn('make it rustic', profile(), {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      history: [],
    });
    expect(result.mode).toBe('ai');
    expect(result.delta.theme).toBe('rustic');
    expect(result.priorityChanges.decoration).toBe('low');
    expect(result.concepts).toHaveLength(1);
  });

  it('falls back safely when the AI response is invalid', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ text: 'not json at all' }), { status: 200 }),
      );
    const result = await planTurn('make it rustic', profile(), {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      history: [],
    });
    expect(result.mode).toBe('demo');
    expect(result.notice).toMatch(/falling back/i);
  });

  it('never throws when the network fails', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('offline'));
    const result = await planTurn('hello', profile(), {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      history: [],
    });
    expect(result.mode).toBe('demo');
    expect(result.notice).toMatch(/unreachable|unavailable/i);
  });

  it('caps history sent to the provider at 6 turns', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ text: JSON.stringify({ reply: 'ok' }) }), { status: 200 }),
      );
    const history = Array.from({ length: 20 }, (_, index) => ({
      role: index % 2 === 0 ? ('user' as const) : ('mira' as const),
      text: `turn ${index}`,
    }));
    await planTurn('hello', profile(), {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      history,
    });
    const body = JSON.parse((fetchImpl.mock.calls[0]?.[1] as { body: string }).body) as {
      history: unknown[];
    };
    expect(body.history.length).toBeLessThanOrEqual(6);
  });
});

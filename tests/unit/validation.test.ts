import { describe, expect, it } from 'vitest';
import {
  clampInt,
  hasControlChars,
  isValidIsoDate,
  parseCount,
  validateAllocation,
  validateBudget,
  validateBudgetKey,
  validateEventCategory,
  validateEventDate,
  validateGuestCount,
  validateText,
  LIMITS,
} from '../../src/lib/validation';

describe('parseCount', () => {
  it('accepts numbers and numeric strings with separators', () => {
    expect(parseCount(42)).toBe(42);
    expect(parseCount('1,000')).toBe(1000);
    expect(parseCount('20000')).toBe(20000);
    expect(parseCount('Rs. 50000')).toBe(50000);
  });

  it('rejects garbage', () => {
    expect(parseCount('abc')).toBeNull();
    expect(parseCount('')).toBeNull();
    expect(parseCount(NaN)).toBeNull();
    expect(parseCount(null)).toBeNull();
    expect(parseCount({})).toBeNull();
  });

  it('floors decimals', () => {
    expect(parseCount('10.9')).toBe(10);
  });
});

describe('validateGuestCount', () => {
  it('accepts sensible counts', () => {
    expect(validateGuestCount('30')).toEqual({ ok: true, value: 30, errors: [] });
    expect(validateGuestCount(250).ok).toBe(true);
  });

  it('rejects zero, negatives and huge counts', () => {
    expect(validateGuestCount(0).ok).toBe(false);
    expect(validateGuestCount(-5).ok).toBe(false);
    expect(validateGuestCount(LIMITS.maxGuestCount + 1).ok).toBe(false);
  });

  it('rejects non-numeric input', () => {
    expect(validateGuestCount('lots').ok).toBe(false);
  });
});

describe('validateBudget', () => {
  it('accepts realistic budgets', () => {
    expect(validateBudget('20000').value).toBe(20000);
    expect(validateBudget(1_200_000).ok).toBe(true);
  });

  it('rejects zero, negative and out-of-range budgets', () => {
    expect(validateBudget(0).ok).toBe(false);
    expect(validateBudget(-1).ok).toBe(false);
    expect(validateBudget(LIMITS.maxBudgetINR + 1).ok).toBe(false);
    expect(validateBudget('twenty').ok).toBe(false);
  });
});

describe('validateAllocation', () => {
  it('accepts 0 up to twice the total', () => {
    expect(validateAllocation(0, 1000).value).toBe(0);
    expect(validateAllocation(2000, 1000).ok).toBe(true);
  });

  it('rejects negatives and absurd values', () => {
    expect(validateAllocation(-1, 1000).ok).toBe(false);
    expect(validateAllocation('x', 1000).ok).toBe(false);
    expect(validateAllocation(10_000_000_001, 1000).ok).toBe(false);
  });
});

describe('validateEventCategory / validateBudgetKey', () => {
  it('accepts known values only', () => {
    expect(validateEventCategory('wedding').ok).toBe(true);
    expect(validateEventCategory('birthday').ok).toBe(true);
    expect(validateEventCategory('community').ok).toBe(true);
    expect(validateEventCategory('concert').ok).toBe(false);
    expect(validateBudgetKey('venue').ok).toBe(true);
    expect(validateBudgetKey('nonsense').ok).toBe(false);
  });
});

describe('date validation', () => {
  it('accepts real ISO dates', () => {
    expect(isValidIsoDate('2026-02-28')).toBe(true);
    expect(isValidIsoDate('2026-12-31')).toBe(true);
  });

  it('rejects impossible or malformed dates', () => {
    expect(isValidIsoDate('2026-02-31')).toBe(false);
    expect(isValidIsoDate('2026-13-01')).toBe(false);
    expect(isValidIsoDate('26-01-01')).toBe(false);
    expect(isValidIsoDate('')).toBe(false);
  });

  it('validateEventDate reports errors', () => {
    expect(validateEventDate('2026-06-01').ok).toBe(true);
    expect(validateEventDate('soon').ok).toBe(false);
    expect(validateEventDate(42).ok).toBe(false);
  });
});

describe('validateText', () => {
  it('enforces length limits', () => {
    const long = 'a'.repeat(LIMITS.maxMessageLength + 1);
    expect(validateText(long, LIMITS.maxMessageLength, 'Message').ok).toBe(false);
    expect(validateText('hello', LIMITS.maxMessageLength, 'Message').value).toBe('hello');
  });

  it('rejects empty text unless allowed', () => {
    expect(validateText('   ', 50, 'Title').ok).toBe(false);
    expect(validateText('   ', 50, 'Notes', true).ok).toBe(true);
  });

  it('rejects control characters', () => {
    const dirty = `bad${String.fromCharCode(0)}value`;
    expect(validateText(dirty, 50, 'Title').ok).toBe(false);
    expect(hasControlChars('clean')).toBe(false);
    expect(hasControlChars(dirty)).toBe(true);
  });
});

describe('clampInt', () => {
  it('clamps and rounds', () => {
    expect(clampInt(5.6, 0, 10)).toBe(6);
    expect(clampInt(-3, 0, 10)).toBe(0);
    expect(clampInt(99, 0, 10)).toBe(10);
    expect(clampInt(NaN, 0, 10)).toBe(0);
  });
});

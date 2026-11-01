/** Centralised input validation. Every user-entered value passes through here. */

import {
  BUDGET_CATEGORY_KEYS,
  EVENT_CATEGORIES,
  type BudgetCategoryKey,
  type EventCategory,
} from '../types';

export const LIMITS = {
  maxMessageLength: 1500,
  maxTitleLength: 80,
  maxLocationLength: 60,
  maxGuestCount: 100_000,
  minGuestCount: 1,
  maxBudgetINR: 10_000_000_000, // 1,000 crore rupees - beyond any personal celebration
  minBudgetINR: 1,
  maxTaskTitleLength: 120,
  maxTasks: 200,
} as const;

export interface ValidationResult<T> {
  ok: boolean;
  value: T | null;
  errors: string[];
}

function ok<T>(value: T): ValidationResult<T> {
  return { ok: true, value, errors: [] };
}

function fail<T>(...errors: string[]): ValidationResult<T> {
  return { ok: false, value: null, errors };
}

/** True if the string contains ASCII control characters (excluding tab/newline). */
export function hasControlChars(value: string): boolean {
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if ((code < 32 && code !== 9 && code !== 10 && code !== 13) || code === 127) return true;
  }
  return false;
}

/** Accepts numbers or numeric strings ("30", "1,000", "20000", "Rs. 50000"). */
export function parseCount(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw)) return Math.floor(raw);
  if (typeof raw !== 'string') return null;
  const cleaned = raw.replace(/[^\d.]/g, '').replace(/^\.+/, '');
  if (!/^\d+(\.\d+)?$/.test(cleaned)) return null;
  const parsed = Number(cleaned);
  if (!Number.isFinite(parsed)) return null;
  return Math.floor(parsed);
}

export function validateGuestCount(raw: unknown): ValidationResult<number> {
  const parsed = parseCount(raw);
  if (parsed === null) return fail('Guest count must be a whole number.');
  if (parsed < LIMITS.minGuestCount || parsed > LIMITS.maxGuestCount) {
    return fail(`Guest count must be between ${LIMITS.minGuestCount} and ${LIMITS.maxGuestCount}.`);
  }
  return ok(parsed);
}

export function validateBudget(raw: unknown): ValidationResult<number> {
  const parsed = parseCount(raw);
  if (parsed === null) return fail('Budget must be a whole number of rupees.');
  if (parsed < LIMITS.minBudgetINR || parsed > LIMITS.maxBudgetINR) {
    return fail('Budget is outside the supported range.');
  }
  return ok(parsed);
}

export function validateAllocation(raw: unknown, totalINR: number): ValidationResult<number> {
  const parsed = parseCount(raw);
  if (parsed === null) return fail('Allocation must be a whole number of rupees.');
  if (parsed < 0) return fail('Allocation cannot be negative.');
  const cap = Math.max(totalINR * 2, LIMITS.maxBudgetINR); // allow deliberate over-allocation to trigger warnings
  if (parsed > cap) return fail('Allocation is unreasonably large.');
  return ok(parsed);
}

export function validateEventCategory(raw: unknown): ValidationResult<EventCategory> {
  if (typeof raw === 'string' && (EVENT_CATEGORIES as readonly string[]).includes(raw)) {
    return ok(raw as EventCategory);
  }
  return fail('Choose a wedding, birthday or community event.');
}

export function validateBudgetKey(raw: unknown): ValidationResult<BudgetCategoryKey> {
  if (typeof raw === 'string' && (BUDGET_CATEGORY_KEYS as readonly string[]).includes(raw)) {
    return ok(raw as BudgetCategoryKey);
  }
  return fail('Unknown budget category.');
}

/** ISO yyyy-mm-dd check with real-calendar validation (rejects 2026-02-31 etc.). */
export function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return false;
  return date.toISOString().slice(0, 10) === value;
}

export function validateEventDate(raw: unknown): ValidationResult<string> {
  if (typeof raw !== 'string' || raw.trim() === '') return fail('Enter a valid date.');
  if (!isValidIsoDate(raw.trim())) return fail('Enter a valid date in YYYY-MM-DD format.');
  return ok(raw.trim());
}

export function validateText(
  raw: unknown,
  maxLength: number,
  label: string,
  allowEmpty = false,
): ValidationResult<string> {
  if (typeof raw !== 'string') return fail(`${label} must be text.`);
  const trimmed = raw.trim();
  if (!allowEmpty && trimmed.length === 0) return fail(`${label} cannot be empty.`);
  if (trimmed.length > maxLength) {
    return fail(`${label} must be ${maxLength} characters or fewer.`);
  }
  if (hasControlChars(trimmed)) {
    return fail(`${label} contains unsupported characters.`);
  }
  return ok(trimmed);
}

export function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
}

/**
 * GenAI orchestration.
 * One entry point (`planTurn`) talks to an OpenAI-compatible endpoint through the
 * local credential-keeping server, validates everything the model returns, and
 * falls back to the deterministic local planner whenever AI is unavailable or unsafe.
 */

import { z } from 'zod';
import type { BudgetCategoryKey, EventProfile, Priority } from '../types';
import { BUDGET_CATEGORY_KEYS } from '../types';
import { buildLocalTurn, defaultTitle, detectIntents, type PlanIntents } from './localPlanner';
import { isValidIsoDate } from './validation';

export const SYSTEM_PROMPT = `You are Mira, a celebration event planner for weddings, birthdays and community events.
Rules:
1. Identify the event category (wedding / birthday / community) and extract structured requirements.
2. Ask at most 3 short clarification questions when essential details are missing.
3. Never invent real vendors, prices, ratings, reviews or availability. All pricing you mention is an ESTIMATE and must be labelled as such.
4. Never claim an estimated price is confirmed.
5. Money, dates and percentages are computed by the application, not by you - do not present arithmetic as authoritative.
6. Reply with JSON only, matching: { "reply": string, "questions": string[], "profile": { "category"?: "wedding"|"birthday"|"community", "title"?: string, "guestCount"?: number|null, "budgetINR"?: number|null, "location"?: string|null, "eventDate"?: "YYYY-MM-DD"|null, "theme"?: string|null, "audience"?: string|null }, "priorityChanges"?: { "<category>": "high"|"medium"|"low" }, "concepts"?: [{ "title": string, "description": string, "theme": string, "palette": string[], "decorations": string[], "food": string[], "entertainment": string[], "budgetImplication": string, "considerations": string[] }] }
7. Omit fields you are unsure about rather than guessing. Keep "reply" under 120 words and friendly.`;

const hexColor = z
  .string()
  .regex(
    /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/,
    'palette entries must be hex colours',
  )
  .max(9);

const conceptSchema = z.object({
  title: z.string().min(3).max(80),
  description: z.string().min(10).max(600),
  theme: z.string().min(2).max(60),
  palette: z.array(hexColor).min(2).max(6),
  decorations: z.array(z.string().min(2).max(160)).min(1).max(6),
  food: z.array(z.string().min(2).max(160)).min(1).max(6),
  entertainment: z.array(z.string().min(2).max(160)).min(1).max(6),
  budgetImplication: z.string().min(3).max(300),
  considerations: z.array(z.string().min(2).max(200)).min(1).max(5),
});

export const aiTurnSchema = z.object({
  reply: z.string().min(1).max(2000),
  questions: z.array(z.string().min(1).max(200)).max(4).default([]),
  profile: z
    .object({
      category: z.enum(['wedding', 'birthday', 'community']).optional(),
      title: z.string().max(80).optional(),
      guestCount: z.number().int().min(1).max(100_000).nullable().optional(),
      budgetINR: z.number().min(1).max(10_000_000_000).nullable().optional(),
      location: z.string().max(60).nullable().optional(),
      eventDate: z
        .string()
        .refine((value) => value === null || isValidIsoDate(value), 'eventDate must be YYYY-MM-DD')
        .nullable()
        .optional(),
      theme: z.string().max(60).nullable().optional(),
      audience: z.string().max(40).nullable().optional(),
    })
    .optional(),
  priorityChanges: z
    .record(
      z.enum(BUDGET_CATEGORY_KEYS as unknown as [BudgetCategoryKey, ...BudgetCategoryKey[]]),
      z.enum(['high', 'medium', 'low']),
    )
    .optional(),
  concepts: z.array(conceptSchema).max(3).optional(),
});

export type AiTurn = z.infer<typeof aiTurnSchema>;

export interface MiraTurnResult {
  mode: 'ai' | 'demo';
  reply: string;
  questions: string[];
  delta: Partial<EventProfile>;
  priorityChanges: Partial<Record<BudgetCategoryKey, Priority>>;
  concepts: AiTurn['concepts'] | null;
  intents: PlanIntents;
  notice: string | null;
}

/** Extract JSON from the model output, tolerating markdown fences. */
export function extractJson(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced?.[1] ? fenced[1].trim() : trimmed;
  return JSON.parse(candidate) as unknown;
}

/** Validate model output. Never throws; returns a user-safe error string. */
export function parseAiTurn(text: string): { data: AiTurn | null; error: string | null } {
  let raw: unknown;
  try {
    raw = extractJson(text);
  } catch {
    return { data: null, error: 'Mira returned an unreadable response.' };
  }
  const result = aiTurnSchema.safeParse(raw);
  if (!result.success) {
    return { data: null, error: 'Mira returned an unexpected response shape.' };
  }
  return { data: result.data, error: null };
}

export interface PlanTurnOptions {
  /** Injected for tests; defaults to window.fetch. */
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  /** Recent conversation turns (text only) for context, capped by the caller. */
  history: Array<{ role: 'user' | 'mira'; text: string }>;
}

/**
 * The single AI orchestration function.
 * Tries the configured provider once; on ANY failure, uses the local planner so the
 * app remains fully usable (demo mode / missing credentials / malformed output).
 */
export async function planTurn(
  message: string,
  profile: EventProfile,
  options: PlanTurnOptions,
): Promise<MiraTurnResult> {
  const local = buildLocalTurn(message, profile);
  const doFetch =
    options.fetchImpl ?? (typeof fetch !== 'undefined' ? fetch.bind(globalThis) : null);

  if (doFetch) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 20_000);
    try {
      const response = await doFetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system: SYSTEM_PROMPT,
          profile,
          // Context limit: only the last 6 turns are sent, never the full transcript.
          history: options.history.slice(-6),
          message,
        }),
        signal: controller.signal,
      });
      if (response.ok) {
        const payload = (await response.json()) as { text?: unknown };
        if (typeof payload.text === 'string') {
          const { data, error } = parseAiTurn(payload.text);
          if (data) {
            return {
              mode: 'ai',
              reply: data.reply,
              questions: data.questions,
              delta: (data.profile ?? {}) as Partial<EventProfile>,
              priorityChanges: (data.priorityChanges ?? {}) as Partial<
                Record<BudgetCategoryKey, Priority>
              >,
              concepts: data.concepts ?? null,
              intents: detectIntents(message),
              notice: null,
            };
          }
          return {
            ...toResult(local, message),
            notice: `${error ?? 'AI output was invalid.'} Falling back to the built-in planner.`,
          };
        }
      }
      if (response.status === 503) {
        return {
          ...toResult(local, message),
          notice: 'Running in demo mode: no AI provider is configured.',
        };
      }
      return {
        ...toResult(local, message),
        notice: 'AI provider unavailable; using the built-in planner.',
      };
    } catch {
      return {
        ...toResult(local, message),
        notice: 'AI provider unreachable; using the built-in planner.',
      };
    } finally {
      clearTimeout(timer);
    }
  }
  return {
    ...toResult(local, message),
    notice: 'Running in demo mode: no AI provider is configured.',
  };
}

function toResult(local: ReturnType<typeof buildLocalTurn>, message: string): MiraTurnResult {
  const delta: Partial<EventProfile> = { ...local.delta };
  if (delta.category && !delta.title) {
    delta.title = defaultTitle({ ...local, ...delta } as EventProfile);
  }
  return {
    mode: 'demo',
    reply: local.reply,
    questions: local.questions,
    delta,
    priorityChanges: local.priorityChanges,
    concepts: null,
    intents: detectIntents(message),
    notice: null,
  };
}

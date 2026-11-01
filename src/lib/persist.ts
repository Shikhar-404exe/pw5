/** Local persistence with schema validation. Corrupt or foreign data is never trusted. */

import { z } from 'zod';
import type { AppState } from '../types';
import { BUDGET_CATEGORY_KEYS, EVENT_CATEGORIES } from '../types';

const prioritySchema = z.enum(['high', 'medium', 'low']);
const statusSchema = z.enum(['pending', 'done']);

const profileSchema = z.object({
  category: z.enum(EVENT_CATEGORIES as unknown as [string, ...string[]]),
  title: z.string().max(80),
  guestCount: z.number().int().min(1).max(100_000).nullable(),
  budgetINR: z.number().min(0).max(10_000_000_000).nullable(),
  location: z.string().max(60).nullable(),
  eventDate: z.string().max(10).nullable(),
  theme: z.string().max(60).nullable(),
  audience: z.string().max(40).nullable(),
  priorities: z.record(
    z.enum(BUDGET_CATEGORY_KEYS as unknown as [string, ...string[]]),
    prioritySchema,
  ),
});

const messageSchema = z.object({
  id: z.string().max(60),
  role: z.enum(['user', 'mira']),
  text: z.string().max(4000),
  notes: z.array(z.string().max(200)).max(6).optional(),
  kind: z.enum(['normal', 'notice', 'error']),
  createdAt: z.number(),
});

const conceptSchema = z.object({
  id: z.string().max(80),
  title: z.string().max(80),
  description: z.string().max(600),
  theme: z.string().max(60),
  palette: z.array(z.string().max(9)).max(6),
  decorations: z.array(z.string().max(160)).max(6),
  food: z.array(z.string().max(160)).max(6),
  entertainment: z.array(z.string().max(160)).max(6),
  budgetImplication: z.string().max(300),
  considerations: z.array(z.string().max(200)).max(5),
  status: z.enum(['suggested', 'accepted', 'rejected']),
  source: z.enum(['ai', 'demo']),
});

const budgetLineSchema = z.object({
  key: z.enum(BUDGET_CATEGORY_KEYS as unknown as [string, ...string[]]),
  label: z.string().max(40),
  allocatedINR: z.number().min(0),
  estimatedINR: z.number().min(0),
  isEstimate: z.boolean(),
  userEdited: z.boolean(),
});

const budgetPlanSchema = z.object({
  totalINR: z.number().min(0),
  lines: z.array(budgetLineSchema).max(20),
});

const timelineTaskSchema = z.object({
  id: z.string().max(60),
  title: z.string().max(120),
  description: z.string().max(300),
  dueDate: z.string().max(10).nullable(),
  relativeLabel: z.string().max(40),
  offsetDays: z.number().min(-10000).max(10000),
  priority: prioritySchema,
  status: statusSchema,
});

const checklistItemSchema = z.object({
  id: z.string().max(60),
  title: z.string().max(120),
  section: z.string().max(40),
  priority: prioritySchema,
  dueDate: z.string().max(10).nullable(),
  relativeLabel: z.string().max(40),
  status: statusSchema,
});

export const appStateSchema = z.object({
  profile: profileSchema.nullable(),
  messages: z.array(messageSchema).max(120),
  concepts: z.array(conceptSchema).max(12),
  budget: budgetPlanSchema.nullable(),
  timeline: z.array(timelineTaskSchema).max(120),
  checklist: z.array(checklistItemSchema).max(120),
  shortlist: z.array(z.string().max(80)).max(50),
  aiMode: z.enum(['demo', 'ai', 'unknown']),
  planGeneratedAt: z.number().nullable(),
});

export const STORAGE_KEY = 'mira.planner.v1';

export function createInitialState(): AppState {
  return {
    profile: null,
    messages: [
      {
        id: 'welcome',
        role: 'mira',
        text: 'Hello, I am Mira. Tell me about your celebration - for example: "A birthday for 30 guests, budget 20,000 rupees, modern theme" - or pick an event type below.',
        kind: 'normal',
        createdAt: Date.now(),
      },
    ],
    concepts: [],
    budget: null,
    timeline: [],
    checklist: [],
    shortlist: [],
    aiMode: 'unknown',
    planGeneratedAt: null,
  };
}

/** Load persisted state. Returns null when absent or invalid - never throws. */
export function loadState(): AppState | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    const result = appStateSchema.safeParse(parsed);
    if (!result.success) return null;
    return result.data as AppState;
  } catch {
    return null;
  }
}

export function saveState(state: AppState): void {
  try {
    // Never persist more than the last 60 messages.
    const trimmed: AppState = { ...state, messages: state.messages.slice(-60) };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // Storage full or unavailable: the app keeps working in memory.
  }
}

export function clearState(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

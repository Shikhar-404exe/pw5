import { describe, expect, it } from 'vitest';
import {
  STORAGE_KEY,
  appStateSchema,
  clearState,
  createInitialState,
  loadState,
  saveState,
} from '../../src/lib/persist';
import { buildDemoState, demoScenarios } from '../../src/lib/demo';

describe('createInitialState', () => {
  it('starts with no event and a welcome message', () => {
    const state = createInitialState();
    expect(state.profile).toBeNull();
    expect(state.budget).toBeNull();
    expect(state.timeline).toEqual([]);
    expect(state.checklist).toEqual([]);
    expect(state.messages).toHaveLength(1);
    expect(state.messages[0]!.role).toBe('mira');
  });
});

describe('saveState / loadState', () => {
  it('round-trips a valid state', () => {
    const state = buildDemoState(demoScenarios()[0]!);
    saveState(state);
    const loaded = loadState();
    expect(loaded).not.toBeNull();
    expect(loaded!.profile?.category).toBe('birthday');
    expect(loaded!.budget?.lines.length).toBeGreaterThan(0);
  });

  it('returns null for corrupt JSON', () => {
    window.localStorage.setItem(STORAGE_KEY, '{not json');
    expect(loadState()).toBeNull();
  });

  it('returns null for structurally invalid data (never trusted)', () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ profile: { category: 'circus' }, messages: 'nope' }),
    );
    expect(loadState()).toBeNull();
  });

  it('trims stored messages to the last 60', () => {
    const state = createInitialState();
    const messages = Array.from({ length: 100 }, (_, index) => ({
      id: `m${index}`,
      role: 'user' as const,
      text: `hello ${index}`,
      kind: 'normal' as const,
      createdAt: index,
    }));
    saveState({ ...state, messages });
    const loaded = loadState();
    expect(loaded!.messages.length).toBe(60);
    expect(loaded!.messages[59]!.text).toBe('hello 99');
  });

  it('clears state without throwing', () => {
    saveState(createInitialState());
    clearState();
    expect(loadState()).toBeNull();
  });

  it('survives localStorage being unavailable', () => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = () => {
      throw new Error('quota');
    };
    expect(() => saveState(createInitialState())).not.toThrow();
    Storage.prototype.setItem = original;
  });
});

describe('demo scenarios', () => {
  it('builds a complete, labelled plan for each category', () => {
    for (const scenario of demoScenarios()) {
      const state = buildDemoState(scenario);
      expect(state.profile?.category).toBe(scenario.id);
      expect(state.budget).not.toBeNull();
      expect(state.timeline.length).toBeGreaterThan(3);
      expect(state.checklist.length).toBeGreaterThan(3);
      expect(state.concepts.length).toBe(3);
      expect(state.aiMode).toBe('demo');
      const totals = state.budget!.lines.reduce((sum, line) => sum + line.allocatedINR, 0);
      expect(totals).toBe(state.budget!.totalINR);
    }
  });

  it('validates against the persisted state schema', () => {
    for (const scenario of demoScenarios()) {
      const state = buildDemoState(scenario);
      expect(appStateSchema.safeParse(state).success).toBe(true);
    }
  });
});

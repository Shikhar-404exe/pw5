import { describe, expect, it } from 'vitest';
import {
  MILESTONE_TEMPLATES,
  buildTimeline,
  daysUntil,
  isOverdue,
  relativeLabel,
  sortTasksByDeadline,
  timelineProgress,
} from '../../src/lib/timeline';
import type { EventProfile } from '../../src/types';

function isoDaysFromToday(days: number, today: Date): string {
  return new Date(today.getTime() + days * 86_400_000).toISOString().slice(0, 10);
}

function profile(overrides: Partial<EventProfile> = {}): EventProfile {
  return {
    category: 'wedding',
    title: 'Test wedding',
    guestCount: 100,
    budgetINR: 1_000_000,
    location: 'Delhi',
    eventDate: '2026-12-01',
    theme: null,
    audience: null,
    priorities: {},
    ...overrides,
  };
}

const today = new Date('2026-06-01T12:00:00Z');

describe('daysUntil', () => {
  it('computes whole days into the future', () => {
    expect(daysUntil('2026-07-31', today)).toBe(60);
  });

  it('is negative for past dates and NaN for invalid input', () => {
    expect(daysUntil('2026-05-01', today)).toBe(-31);
    expect(Number.isNaN(daysUntil('not-a-date', today))).toBe(true);
  });
});

describe('relativeLabel', () => {
  it('labels offsets', () => {
    expect(relativeLabel(0)).toBe('Event day');
    expect(relativeLabel(-1)).toBe('1 day before');
    expect(relativeLabel(-45)).toBe('45 days before');
  });
});

describe('buildTimeline', () => {
  it('creates dated tasks for a distant event, sorted by deadline', () => {
    const { tasks, warning } = buildTimeline(
      profile({ eventDate: isoDaysFromToday(90, today) }),
      today,
    );
    expect(warning).toBeNull();
    expect(tasks.length).toBeGreaterThan(5);
    const dates = tasks.map((task) => task.dueDate);
    expect([...dates].sort()).toEqual(dates);
    expect(tasks[tasks.length - 1]!.offsetDays).toBe(0);
  });

  it('compresses milestones when the event is close - never impossible deadlines', () => {
    const eventDate = isoDaysFromToday(20, today);
    const { tasks } = buildTimeline(profile({ eventDate }), today);
    for (const task of tasks) {
      expect(task.dueDate! <= eventDate).toBe(true);
      expect(task.dueDate! >= isoDaysFromToday(-20, today)).toBe(true);
    }
    expect(tasks.some((task) => task.offsetDays === 0)).toBe(true);
  });

  it('keeps only immediate tasks when the event is days away', () => {
    const { tasks } = buildTimeline(profile({ eventDate: isoDaysFromToday(2, today) }), today);
    expect(tasks.every((task) => task.offsetDays >= -1)).toBe(true);
  });

  it('returns a clearly labelled relative schedule without a date', () => {
    const { tasks, warning } = buildTimeline(profile({ eventDate: null }), today);
    expect(warning).toMatch(/relative/i);
    expect(tasks.every((task) => task.dueDate === null)).toBe(true);
    expect(tasks[0]!.relativeLabel).toContain('days before');
  });

  it('refuses to schedule an event in the past', () => {
    const { tasks, warning } = buildTimeline(profile({ eventDate: '2020-01-01' }), today);
    expect(tasks).toEqual([]);
    expect(warning).toMatch(/past/i);
  });

  it('rejects an invalid date', () => {
    const { tasks, warning } = buildTimeline(profile({ eventDate: '2026-99-99' }), today);
    expect(tasks).toEqual([]);
    expect(warning).toMatch(/invalid/i);
  });

  it('adapts templates to each event category', () => {
    expect(MILESTONE_TEMPLATES.wedding.length).toBeGreaterThan(MILESTONE_TEMPLATES.birthday.length);
    for (const category of ['wedding', 'birthday', 'community'] as const) {
      const { tasks } = buildTimeline(
        profile({ category, eventDate: isoDaysFromToday(60, today) }),
        today,
      );
      expect(tasks.length).toBeGreaterThan(0);
    }
  });
});

describe('isOverdue', () => {
  it('marks pending tasks past their due date', () => {
    const task = {
      id: 't1',
      title: 'x',
      description: 'x',
      dueDate: '2026-05-30',
      relativeLabel: '2 days before',
      offsetDays: -2,
      priority: 'high' as const,
      status: 'pending' as const,
    };
    expect(isOverdue(task, today)).toBe(true);
    expect(isOverdue({ ...task, status: 'done' }, today)).toBe(false);
    expect(isOverdue({ ...task, dueDate: null }, today)).toBe(false);
    expect(isOverdue({ ...task, dueDate: '2026-06-02' }, today)).toBe(false);
  });
});

describe('sortTasksByDeadline', () => {
  it('sorts by date with undated tasks last', () => {
    const tasks = [
      { id: 'a', dueDate: null, offsetDays: -10 },
      { id: 'b', dueDate: '2026-07-01', offsetDays: -30 },
      { id: 'c', dueDate: '2026-06-15', offsetDays: -14 },
    ].map((entry) => ({
      ...entry,
      title: entry.id,
      description: '',
      relativeLabel: '',
      priority: 'medium' as const,
      status: 'pending' as const,
    }));
    expect(sortTasksByDeadline(tasks).map((task) => task.id)).toEqual(['c', 'b', 'a']);
  });
});

describe('timelineProgress', () => {
  it('counts completed tasks', () => {
    const { tasks } = buildTimeline(profile({ eventDate: isoDaysFromToday(60, today) }), today);
    const withDone = tasks.map((task, index) => ({
      ...task,
      status: index < 2 ? ('done' as const) : ('pending' as const),
    }));
    expect(timelineProgress(withDone)).toEqual({ done: 2, total: tasks.length });
    expect(timelineProgress([])).toEqual({ done: 0, total: 0 });
  });
});

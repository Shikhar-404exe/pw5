import { describe, expect, it } from 'vitest';
import {
  addChecklistItem,
  buildChecklist,
  checklistProgress,
  groupBySection,
  removeChecklistItem,
  toggleChecklistItem,
  updateChecklistItem,
} from '../../src/lib/checklist';
import type { EventProfile } from '../../src/types';

function profile(overrides: Partial<EventProfile> = {}): EventProfile {
  return {
    category: 'wedding',
    title: 'Test wedding',
    guestCount: 100,
    budgetINR: 1_000_000,
    location: null,
    eventDate: '2026-12-01',
    theme: null,
    audience: null,
    priorities: {},
    ...overrides,
  };
}

describe('buildChecklist', () => {
  it('creates wedding staples with dated offsets', () => {
    const items = buildChecklist(profile());
    const titles = items.map((item) => item.title);
    expect(titles).toContain('Finalise venue');
    expect(titles).toContain('Book caterer');
    expect(items.every((item) => item.status === 'pending')).toBe(true);
    expect(items.every((item) => item.dueDate !== null)).toBe(true);
  });

  it('creates birthday and community staples', () => {
    const birthday = buildChecklist(profile({ category: 'birthday' })).map((item) => item.title);
    expect(birthday).toContain('Order cake');
    const community = buildChecklist(profile({ category: 'community' })).map((item) => item.title);
    expect(community).toContain('Verify permissions where required');
  });

  it('labels relative dates when no event date exists', () => {
    const items = buildChecklist(profile({ eventDate: null }));
    expect(items.every((item) => item.dueDate === null)).toBe(true);
    expect(items[0]!.relativeLabel).toContain('days before');
  });
});

describe('checklist CRUD', () => {
  it('adds items as pending', () => {
    const items = addChecklistItem([], {
      id: 'x1',
      title: 'Book DJ',
      section: 'Fun',
      priority: 'high',
      dueDate: null,
      relativeLabel: 'No date set',
    });
    expect(items).toHaveLength(1);
    expect(items[0]!.status).toBe('pending');
  });

  it('toggles completion both ways', () => {
    const start = buildChecklist(profile());
    const id = start[0]!.id;
    const done = toggleChecklistItem(start, id);
    expect(done[0]!.status).toBe('done');
    const undone = toggleChecklistItem(done, id);
    expect(undone[0]!.status).toBe('pending');
  });

  it('edits fields by id and ignores unknown ids', () => {
    const start = buildChecklist(profile());
    const id = start[0]!.id;
    const updated = updateChecklistItem(start, id, { title: 'Renamed', priority: 'low' });
    expect(updated[0]!.title).toBe('Renamed');
    expect(updated[0]!.priority).toBe('low');
    expect(updateChecklistItem(start, 'nope', { title: 'x' })).toEqual(start);
  });

  it('deletes items by id', () => {
    const start = buildChecklist(profile());
    const removed = removeChecklistItem(start, start[0]!.id);
    expect(removed).toHaveLength(start.length - 1);
  });
});

describe('checklistProgress', () => {
  it('computes percentage and handles the empty checklist', () => {
    const start = buildChecklist(profile());
    const half = start.map((item, index) => ({
      ...item,
      status: index === 0 ? ('done' as const) : ('pending' as const),
    }));
    const progress = checklistProgress(half);
    expect(progress.done).toBe(1);
    expect(progress.total).toBe(start.length);
    expect(progress.percent).toBe(Math.round((1 / start.length) * 100));
    expect(checklistProgress([])).toEqual({ done: 0, total: 0, percent: 0 });
  });
});

describe('groupBySection', () => {
  it('groups items while preserving order', () => {
    const groups = groupBySection(buildChecklist(profile()));
    expect(groups.length).toBeGreaterThan(1);
    const total = groups.reduce((sum, group) => sum + group.items.length, 0);
    expect(total).toBe(buildChecklist(profile()).length);
    expect(groups.every((group) => group.section.length > 0)).toBe(true);
  });
});

/** Interactive event checklist: templates, CRUD and progress. */

import type { ChecklistItem, EventCategory, EventProfile, Priority } from '../types';
import { isValidIsoDate } from './validation';
import { relativeLabel } from './timeline';

interface ChecklistSeed {
  id: string;
  title: string;
  section: string;
  priority: Priority;
  offsetDays: number;
}

const CHECKLIST_SEEDS: Record<EventCategory, ChecklistSeed[]> = {
  wedding: [
    {
      id: 'wc-venue',
      title: 'Finalise venue',
      section: 'Venue & vendors',
      priority: 'high',
      offsetDays: -60,
    },
    {
      id: 'wc-caterer',
      title: 'Book caterer',
      section: 'Venue & vendors',
      priority: 'high',
      offsetDays: -45,
    },
    {
      id: 'wc-photo',
      title: 'Arrange photography',
      section: 'Venue & vendors',
      priority: 'medium',
      offsetDays: -40,
    },
    {
      id: 'wc-decor',
      title: 'Finalise decoration',
      section: 'Venue & vendors',
      priority: 'medium',
      offsetDays: -21,
    },
    {
      id: 'wc-guests',
      title: 'Confirm guest list and RSVPs',
      section: 'Guests',
      priority: 'high',
      offsetDays: -21,
    },
    {
      id: 'wc-outfits',
      title: 'Finalise outfits and styling',
      section: 'Guests',
      priority: 'medium',
      offsetDays: -14,
    },
    {
      id: 'wc-transport',
      title: 'Confirm transportation',
      section: 'Logistics',
      priority: 'medium',
      offsetDays: -7,
    },
    {
      id: 'wc-payments',
      title: 'Check final payments',
      section: 'Logistics',
      priority: 'high',
      offsetDays: -2,
    },
  ],
  birthday: [
    {
      id: 'bc-venue',
      title: 'Select venue',
      section: 'Venue & vendors',
      priority: 'high',
      offsetDays: -21,
    },
    {
      id: 'bc-entertainment',
      title: 'Organise entertainment or games',
      section: 'Venue & vendors',
      priority: 'medium',
      offsetDays: -10,
    },
    {
      id: 'bc-guests',
      title: 'Prepare guest list',
      section: 'Guests',
      priority: 'high',
      offsetDays: -14,
    },
    { id: 'bc-cake', title: 'Order cake', section: 'Food', priority: 'high', offsetDays: -7 },
    {
      id: 'bc-food',
      title: 'Confirm food and drinks',
      section: 'Food',
      priority: 'high',
      offsetDays: -5,
    },
    {
      id: 'bc-decor',
      title: 'Arrange decoration and supplies',
      section: 'Décor',
      priority: 'medium',
      offsetDays: -3,
    },
  ],
  community: [
    {
      id: 'cc-objectives',
      title: 'Define objectives',
      section: 'Planning',
      priority: 'high',
      offsetDays: -45,
    },
    {
      id: 'cc-permissions',
      title: 'Verify permissions where required',
      section: 'Planning',
      priority: 'high',
      offsetDays: -30,
    },
    {
      id: 'cc-venue',
      title: 'Confirm venue',
      section: 'Venue & vendors',
      priority: 'high',
      offsetDays: -30,
    },
    {
      id: 'cc-volunteers',
      title: 'Coordinate volunteers',
      section: 'People',
      priority: 'medium',
      offsetDays: -21,
    },
    {
      id: 'cc-equipment',
      title: 'Arrange equipment',
      section: 'Logistics',
      priority: 'medium',
      offsetDays: -14,
    },
    {
      id: 'cc-publicity',
      title: 'Organise publicity',
      section: 'Outreach',
      priority: 'medium',
      offsetDays: -14,
    },
    {
      id: 'cc-logistics',
      title: 'Plan logistics and cleanup',
      section: 'Logistics',
      priority: 'high',
      offsetDays: -7,
    },
  ],
};

export function buildChecklist(profile: EventProfile): ChecklistItem[] {
  const seeds = CHECKLIST_SEEDS[profile.category];
  const hasDate = profile.eventDate !== null && isValidIsoDate(profile.eventDate);
  const eventDay = hasDate ? new Date(`${profile.eventDate as string}T00:00:00Z`) : null;
  return seeds.map((seed) => ({
    id: seed.id,
    title: seed.title,
    section: seed.section,
    priority: seed.priority,
    relativeLabel: relativeLabel(seed.offsetDays),
    dueDate: eventDay
      ? new Date(eventDay.getTime() + seed.offsetDays * 86_400_000).toISOString().slice(0, 10)
      : null,
    status: 'pending',
  }));
}

export function addChecklistItem(
  items: ChecklistItem[],
  item: Omit<ChecklistItem, 'status'>,
): ChecklistItem[] {
  return [...items, { ...item, status: 'pending' }];
}

export function updateChecklistItem(
  items: ChecklistItem[],
  id: string,
  patch: Partial<
    Pick<ChecklistItem, 'title' | 'section' | 'priority' | 'dueDate' | 'relativeLabel'>
  >,
): ChecklistItem[] {
  return items.map((item) => (item.id === id ? { ...item, ...patch } : item));
}

export function toggleChecklistItem(items: ChecklistItem[], id: string): ChecklistItem[] {
  return items.map((item) =>
    item.id === id ? { ...item, status: item.status === 'done' ? 'pending' : 'done' } : item,
  );
}

export function removeChecklistItem(items: ChecklistItem[], id: string): ChecklistItem[] {
  return items.filter((item) => item.id !== id);
}

export function checklistProgress(items: ChecklistItem[]): {
  done: number;
  total: number;
  percent: number;
} {
  const done = items.filter((item) => item.status === 'done').length;
  const total = items.length;
  return { done, total, percent: total === 0 ? 0 : Math.round((done / total) * 100) };
}

export function groupBySection(
  items: ChecklistItem[],
): Array<{ section: string; items: ChecklistItem[] }> {
  const groups = new Map<string, ChecklistItem[]>();
  for (const item of items) {
    const bucket = groups.get(item.section);
    if (bucket) bucket.push(item);
    else groups.set(item.section, [item]);
  }
  return [...groups.entries()].map(([section, bucket]) => ({ section, items: bucket }));
}

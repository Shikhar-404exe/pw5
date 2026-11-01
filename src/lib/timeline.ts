/**
 * Date-aware timeline generator.
 * Milestone templates are compressed proportionally when the event is close,
 * so Mira never invents impossible lead times.
 */

import type { EventCategory, EventProfile, Priority, TimelineTask } from '../types';
import { isValidIsoDate } from './validation';

export interface MilestoneTemplate {
  id: string;
  title: string;
  description: string;
  /** Negative = days before the event. */
  offsetDays: number;
  priority: Priority;
}

export const MILESTONE_TEMPLATES: Record<EventCategory, MilestoneTemplate[]> = {
  wedding: [
    {
      id: 'w-define',
      title: 'Define requirements and budget',
      description: 'Lock guest count, budget ceiling and the overall style direction.',
      offsetDays: -120,
      priority: 'high',
    },
    {
      id: 'w-venue',
      title: 'Shortlist venues and vendors',
      description: 'Visit venues and shortlist caterers, decorators and photographers.',
      offsetDays: -90,
      priority: 'high',
    },
    {
      id: 'w-book',
      title: 'Book major vendors',
      description: 'Sign contracts for venue, catering and photography.',
      offsetDays: -60,
      priority: 'high',
    },
    {
      id: 'w-invites',
      title: 'Send invitations',
      description: 'Dispatch invites and start tracking RSVPs.',
      offsetDays: -45,
      priority: 'medium',
    },
    {
      id: 'w-guests',
      title: 'Confirm guest arrangements',
      description: 'Finalise headcount, seating plan and travel logistics.',
      offsetDays: -21,
      priority: 'high',
    },
    {
      id: 'w-detail',
      title: 'Finalise decoration and catering menu',
      description: 'Approve decor samples and tasting menu.',
      offsetDays: -14,
      priority: 'medium',
    },
    {
      id: 'w-confirm',
      title: 'Confirm vendors and logistics',
      description: 'Reconfirm timings, deliveries and payments schedule.',
      offsetDays: -7,
      priority: 'high',
    },
    {
      id: 'w-verify',
      title: 'Final verification',
      description: 'Walk through the run-sheet and verify remaining payments.',
      offsetDays: -1,
      priority: 'high',
    },
    {
      id: 'w-day',
      title: 'Event day execution',
      description: 'Follow the run-sheet; keep vendor contacts on hand.',
      offsetDays: 0,
      priority: 'high',
    },
  ],
  birthday: [
    {
      id: 'b-define',
      title: 'Define theme, guest list and budget',
      description: 'Decide the vibe, who is invited and the spending ceiling.',
      offsetDays: -30,
      priority: 'high',
    },
    {
      id: 'b-venue',
      title: 'Book venue and entertainment',
      description: 'Reserve the space and any games, DJ or activities.',
      offsetDays: -21,
      priority: 'high',
    },
    {
      id: 'b-cake',
      title: 'Order cake and confirm catering',
      description: 'Place the cake order and lock the food menu.',
      offsetDays: -14,
      priority: 'medium',
    },
    {
      id: 'b-invites',
      title: 'Send invites and track RSVPs',
      description: 'Share invitations and follow up on responses.',
      offsetDays: -10,
      priority: 'medium',
    },
    {
      id: 'b-decor',
      title: 'Finalise decoration and supplies',
      description: 'Confirm decor plan, props and party supplies.',
      offsetDays: -5,
      priority: 'medium',
    },
    {
      id: 'b-confirm',
      title: 'Confirm vendors and logistics',
      description: 'Reconfirm arrival times and any rentals.',
      offsetDays: -2,
      priority: 'high',
    },
    {
      id: 'b-day',
      title: 'Event day set-up',
      description: 'Arrive early, set up and enjoy the celebration.',
      offsetDays: 0,
      priority: 'high',
    },
  ],
  community: [
    {
      id: 'c-objectives',
      title: 'Define objectives and budget',
      description: 'Agree purpose, audience, budget and success measures.',
      offsetDays: -60,
      priority: 'high',
    },
    {
      id: 'c-venue',
      title: 'Confirm venue and permissions',
      description: 'Book the venue and apply for any required permissions.',
      offsetDays: -45,
      priority: 'high',
    },
    {
      id: 'c-volunteers',
      title: 'Coordinate volunteers',
      description: 'Recruit volunteers and assign roles.',
      offsetDays: -30,
      priority: 'medium',
    },
    {
      id: 'c-equipment',
      title: 'Arrange equipment and rentals',
      description: 'Source sound systems, seating, stalls and signage.',
      offsetDays: -21,
      priority: 'medium',
    },
    {
      id: 'c-publicity',
      title: 'Organise publicity',
      description: 'Run posters, social posts and local announcements.',
      offsetDays: -14,
      priority: 'medium',
    },
    {
      id: 'c-logistics',
      title: 'Plan logistics',
      description: 'Finalise food, water, first aid and cleanup crews.',
      offsetDays: -7,
      priority: 'high',
    },
    {
      id: 'c-verify',
      title: 'Final verification',
      description: 'Walk through the run-sheet with volunteer leads.',
      offsetDays: -1,
      priority: 'high',
    },
    {
      id: 'c-day',
      title: 'Event day execution',
      description: 'Run the event from the shared run-sheet.',
      offsetDays: 0,
      priority: 'high',
    },
  ],
};

export function relativeLabel(offsetDays: number): string {
  if (offsetDays === 0) return 'Event day';
  if (offsetDays === -1) return '1 day before';
  return `${Math.abs(offsetDays)} days before`;
}

export const MIN_LEAD_DAYS = 3; // below this, only the immediate tasks make sense

function toIso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Whole days from today until the event date (UTC, date-only). */
export function daysUntil(eventDate: string, today: Date): number {
  if (!isValidIsoDate(eventDate)) return Number.NaN;
  const event = new Date(`${eventDate}T00:00:00Z`).getTime();
  const base = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  return Math.round((event - base) / 86_400_000);
}

/**
 * Build the preparation timeline.
 * - Known date: offsets are compressed proportionally to the real window, then mapped to dates.
 * - Unknown date: relative labels only, clearly marked as an estimate.
 * Returns an empty list with `warning` when the event date is in the past.
 */
export function buildTimeline(
  profile: EventProfile,
  today: Date = new Date(),
): { tasks: TimelineTask[]; warning: string | null } {
  const templates = MILESTONE_TEMPLATES[profile.category];

  if (!profile.eventDate) {
    return {
      tasks: templates.map((template) => ({
        id: template.id,
        title: template.title,
        description: template.description,
        dueDate: null,
        relativeLabel: relativeLabel(template.offsetDays),
        offsetDays: template.offsetDays,
        priority: template.priority,
        status: 'pending',
      })),
      warning: 'Event date not set - showing a relative schedule.',
    };
  }

  const remaining = daysUntil(profile.eventDate, today);
  if (Number.isNaN(remaining)) {
    return { tasks: [], warning: 'The event date is invalid.' };
  }
  if (remaining < 0) {
    return { tasks: [], warning: 'The event date is in the past.' };
  }

  const maxLead = Math.max(...templates.map((template) => Math.abs(template.offsetDays)));
  const scale = remaining < maxLead ? remaining / maxLead : 1;

  const eventDay = new Date(`${profile.eventDate}T00:00:00Z`);
  const tasks: TimelineTask[] = [];
  for (const template of templates) {
    let offset = Math.round(template.offsetDays * scale);
    offset = Math.max(-remaining, Math.min(0, offset));
    // With almost no runway, keep only the closing tasks.
    if (remaining < MIN_LEAD_DAYS && offset < -1) continue;
    const due = new Date(eventDay.getTime() + offset * 86_400_000);
    tasks.push({
      id: template.id,
      title: template.title,
      description: template.description,
      dueDate: toIso(due),
      relativeLabel: relativeLabel(offset),
      offsetDays: offset,
      priority: template.priority,
      status: 'pending',
    });
  }
  tasks.sort((a, b) => {
    if (a.dueDate === null && b.dueDate === null) return a.offsetDays - b.offsetDays;
    if (a.dueDate === null) return 1;
    if (b.dueDate === null) return -1;
    return a.dueDate.localeCompare(b.dueDate);
  });
  return { tasks, warning: null };
}

export function isOverdue(task: TimelineTask, today: Date = new Date()): boolean {
  if (task.status === 'done' || !task.dueDate) return false;
  const base = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const due = new Date(`${task.dueDate}T00:00:00Z`).getTime();
  return due < base;
}

export function sortTasksByDeadline(tasks: TimelineTask[]): TimelineTask[] {
  return [...tasks].sort((a, b) => {
    if (a.dueDate === null && b.dueDate === null) return a.offsetDays - b.offsetDays;
    if (a.dueDate === null) return 1;
    if (b.dueDate === null) return -1;
    return a.dueDate.localeCompare(b.dueDate);
  });
}

export function timelineProgress(tasks: TimelineTask[]): { done: number; total: number } {
  return { done: tasks.filter((task) => task.status === 'done').length, total: tasks.length };
}

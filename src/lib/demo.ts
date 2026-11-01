/**
 * Built-in demonstration scenarios.
 * Every value here is clearly-labelled demonstration data so the full workflow
 * can be shown without any API credentials or real personal information.
 */

import type { AppState, EventProfile } from '../types';
import { createBudgetPlan } from './budget';
import { buildChecklist } from './checklist';
import { generateConcepts } from './ideas';
import { createInitialState } from './persist';
import { buildTimeline } from './timeline';

export interface DemoScenario {
  id: EventProfile['category'];
  label: string;
  profile: EventProfile;
}

function daysFromToday(days: number, today: Date): string {
  const date = new Date(today.getTime());
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function demoScenarios(today: Date = new Date()): DemoScenario[] {
  return [
    {
      id: 'birthday',
      label: 'Birthday (demo)',
      profile: {
        category: 'birthday',
        title: 'Birthday in Bengaluru',
        guestCount: 30,
        budgetINR: 20_000,
        location: 'Bengaluru',
        eventDate: daysFromToday(21, today),
        theme: 'playful',
        audience: 'friends',
        priorities: { cake: 'high' },
      },
    },
    {
      id: 'wedding',
      label: 'Wedding (demo)',
      profile: {
        category: 'wedding',
        title: 'Wedding in Delhi',
        guestCount: 250,
        budgetINR: 1_200_000,
        location: 'Delhi',
        eventDate: daysFromToday(90, today),
        theme: 'modern elegant',
        audience: null,
        priorities: { photography: 'high', decoration: 'low' },
      },
    },
    {
      id: 'community',
      label: 'Community event (demo)',
      profile: {
        category: 'community',
        title: 'Community festival in Jaipur',
        guestCount: 200,
        budgetINR: 150_000,
        location: 'Jaipur',
        eventDate: daysFromToday(45, today),
        theme: 'festive',
        audience: 'all ages',
        priorities: { publicity: 'high' },
      },
    },
  ];
}

/** Build the complete derived plan for a demo scenario (labelled demonstration data). */
export function buildDemoState(scenario: DemoScenario, today: Date = new Date()): AppState {
  const profile = scenario.profile;
  const budget = createBudgetPlan(profile);
  const timeline = buildTimeline(profile, today);
  const concepts = generateConcepts(profile, budget);
  const base = createInitialState();
  return {
    ...base,
    profile,
    concepts,
    budget,
    timeline: timeline.tasks,
    checklist: buildChecklist(profile),
    aiMode: 'demo',
    planGeneratedAt: Date.now(),
    messages: [
      ...base.messages,
      {
        id: `demo-${scenario.id}`,
        role: 'mira',
        text: `Loaded the ${scenario.label} demonstration plan. All figures and vendors in demo mode are clearly labelled samples - edit anything you like.`,
        kind: 'notice',
        createdAt: Date.now(),
      },
    ],
  };
}

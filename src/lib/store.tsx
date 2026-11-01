/**
 * Application state: a single reducer plus derived-plan synchronisation.
 * All plan-producing logic delegates to the deterministic engines; the AI layer
 * only ever supplies validated deltas.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
} from 'react';
import type {
  AiMode,
  AppState,
  BudgetCategoryKey,
  ChatMessage,
  ChecklistItem,
  ConceptStatus,
  EventCategory,
  EventProfile,
  EventConcept,
  TimelineTask,
} from '../types';
import { type MiraTurnResult, planTurn } from './ai';
import { createBudgetPlan, rebalanceBudget, retotalBudget, setAllocation } from './budget';
import {
  addChecklistItem,
  buildChecklist,
  checklistProgress,
  removeChecklistItem,
  toggleChecklistItem,
  updateChecklistItem,
} from './checklist';
import { buildDemoState, demoScenarios } from './demo';
import { generateConcepts, refineConcept } from './ideas';
import { detectCategory } from './localPlanner';
import { clearState, createInitialState, loadState, saveState } from './persist';
import { buildTimeline, isOverdue, timelineProgress, sortTasksByDeadline } from './timeline';
import {
  LIMITS,
  validateBudget,
  validateEventDate,
  validateGuestCount,
  validateText,
} from './validation';

let idCounter = 0;
function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${idCounter}`;
}

export function createProfile(category: EventCategory): EventProfile {
  const title =
    category === 'wedding' ? 'Wedding' : category === 'birthday' ? 'Birthday' : 'Community event';
  return {
    category,
    title,
    guestCount: null,
    budgetINR: null,
    location: null,
    eventDate: null,
    theme: null,
    audience: null,
    priorities: {},
  };
}

interface DerivedOptions {
  ideas?: boolean;
  budget?: boolean;
  timeline?: boolean;
  checklist?: boolean;
  all?: boolean;
}

/**
 * Regenerate derived artefacts after the profile changes, preserving user work:
 * edited allocations, completed tasks and accepted concepts survive updates.
 */
function syncDerived(state: AppState, today: Date, options: DerivedOptions): AppState {
  if (!state.profile) return state;
  const profile = state.profile;
  let { budget, timeline, checklist, concepts } = state;

  const wantsBudget = options.all || options.budget || budget !== null;
  if (wantsBudget && profile.budgetINR !== null && profile.budgetINR > 0) {
    if (budget === null) {
      budget = createBudgetPlan(profile);
    } else if (budget.totalINR !== profile.budgetINR) {
      budget = retotalBudget(budget, profile.budgetINR);
    } else {
      budget = rebalanceBudget(budget, profile);
    }
  }

  const wantsTimeline = options.all || options.timeline || timeline.length > 0;
  if (wantsTimeline) {
    const previous = new Map(timeline.map((task) => [task.id, task.status]));
    const built = buildTimeline(profile, today);
    timeline = sortTasksByDeadline(
      built.tasks.map((task) => ({ ...task, status: previous.get(task.id) ?? task.status })),
    );
  }

  const wantsChecklist = options.all || options.checklist || checklist.length > 0;
  if (wantsChecklist) {
    const previous = new Map(checklist.map((item) => [item.id, item]));
    checklist = buildChecklist(profile).map((item) => {
      const existing = previous.get(item.id);
      return existing ? { ...item, status: existing.status } : item;
    });
  }

  const wantsIdeas = options.all || options.ideas;
  if (wantsIdeas) {
    const rejected = new Set(
      concepts.filter((concept) => concept.status === 'rejected').map((concept) => concept.id),
    );
    const existing = new Set(concepts.map((concept) => concept.id));
    const fresh = generateConcepts(profile, budget).filter(
      (concept) => !rejected.has(concept.id) && !existing.has(concept.id),
    );
    concepts = [...concepts, ...fresh];
  }

  return { ...state, profile, budget, timeline, checklist, concepts };
}

type Action =
  | { type: 'create-profile'; profile: EventProfile }
  | { type: 'patch-profile'; patch: Partial<EventProfile> }
  | { type: 'add-message'; message: ChatMessage }
  | { type: 'apply-turn'; result: MiraTurnResult }
  | { type: 'concept-status'; id: string; status: ConceptStatus }
  | { type: 'refine-concept'; id: string }
  | { type: 'generate'; options: DerivedOptions }
  | { type: 'set-allocation'; key: BudgetCategoryKey; amountINR: number }
  | { type: 'retotal-budget'; totalINR: number }
  | { type: 'reset-budget' }
  | { type: 'timeline-toggle'; id: string }
  | {
      type: 'timeline-update';
      id: string;
      patch: Partial<Pick<TimelineTask, 'title' | 'description' | 'dueDate' | 'priority'>>;
    }
  | {
      type: 'timeline-add';
      title: string;
      description: string;
      dueDate: string | null;
      priority: TimelineTask['priority'];
    }
  | { type: 'timeline-delete'; id: string }
  | { type: 'checklist-toggle'; id: string }
  | {
      type: 'checklist-update';
      id: string;
      patch: Partial<Pick<ChecklistItem, 'title' | 'section' | 'priority' | 'dueDate'>>;
    }
  | { type: 'checklist-add'; title: string; section: string; priority: ChecklistItem['priority'] }
  | { type: 'checklist-delete'; id: string }
  | { type: 'shortlist-toggle'; id: string }
  | { type: 'set-ai-mode'; mode: AiMode }
  | { type: 'load-state'; state: AppState }
  | { type: 'reset' };

function reducer(state: AppState, action: Action): AppState {
  const today = new Date();
  switch (action.type) {
    case 'create-profile':
      return syncDerived({ ...state, profile: action.profile }, today, {});
    case 'patch-profile': {
      if (!state.profile) return state;
      const profile = { ...state.profile, ...action.patch };
      return syncDerived({ ...state, profile }, today, {});
    }
    case 'add-message':
      return { ...state, messages: [...state.messages, action.message] };
    case 'apply-turn': {
      const { result } = action;
      const noticeMessage: ChatMessage | null = result.notice
        ? {
            id: nextId('notice'),
            role: 'mira',
            text: result.notice,
            kind: 'notice',
            createdAt: Date.now(),
          }
        : null;
      const replyMessage: ChatMessage = {
        id: nextId('mira'),
        role: 'mira',
        text: result.reply,
        notes: result.questions.length > 0 ? result.questions : undefined,
        kind: 'normal',
        createdAt: Date.now(),
      };
      let next: AppState = {
        ...state,
        messages: [...state.messages, ...(noticeMessage ? [noticeMessage] : []), replyMessage],
        aiMode: result.mode,
      };
      if (next.profile) {
        const merged: EventProfile = {
          ...next.profile,
          ...result.delta,
          priorities: { ...next.profile.priorities, ...result.priorityChanges },
        };
        next = { ...next, profile: merged };
      }
      if (result.concepts && result.concepts.length > 0) {
        const rejected = new Set(
          next.concepts
            .filter((concept) => concept.status === 'rejected')
            .map((concept) => concept.id),
        );
        const aiConcepts: EventConcept[] = result.concepts
          .slice(0, 3)
          .map((concept) => ({
            id: nextId('ai-concept'),
            title: concept.title,
            description: concept.description,
            theme: concept.theme,
            palette: concept.palette,
            decorations: concept.decorations,
            food: concept.food,
            entertainment: concept.entertainment,
            budgetImplication: concept.budgetImplication,
            considerations: concept.considerations,
            status: 'suggested' as const,
            source: 'ai' as const,
          }))
          .filter((concept) => !rejected.has(concept.id));
        next = { ...next, concepts: [...next.concepts, ...aiConcepts] };
      }
      return syncDerived(next, today, {
        ideas: result.intents.wantsIdeas,
        budget: result.intents.wantsBudget,
        timeline: result.intents.wantsTimeline,
        checklist: result.intents.wantsChecklist,
        all: result.intents.wantsAll,
      });
    }
    case 'concept-status': {
      const concepts = state.concepts.map((concept) =>
        concept.id === action.id ? { ...concept, status: action.status } : concept,
      );
      return { ...state, concepts };
    }
    case 'refine-concept': {
      if (!state.profile) return state;
      const concepts = state.concepts.map((concept) =>
        concept.id === action.id
          ? refineConcept(concept, state.profile as EventProfile, state.budget)
          : concept,
      );
      return { ...state, concepts };
    }
    case 'generate':
      return { ...syncDerived(state, today, action.options), planGeneratedAt: Date.now() };
    case 'set-allocation': {
      if (!state.budget) return state;
      return { ...state, budget: setAllocation(state.budget, action.key, action.amountINR) };
    }
    case 'retotal-budget': {
      if (!state.budget) return state;
      const budget = retotalBudget(state.budget, action.totalINR);
      return {
        ...state,
        budget,
        profile: state.profile ? { ...state.profile, budgetINR: action.totalINR } : state.profile,
      };
    }
    case 'reset-budget': {
      if (!state.profile?.budgetINR) return state;
      return { ...state, budget: createBudgetPlan(state.profile) };
    }
    case 'timeline-toggle':
      return {
        ...state,
        timeline: state.timeline.map((task) =>
          task.id === action.id
            ? { ...task, status: task.status === 'done' ? 'pending' : 'done' }
            : task,
        ),
      };
    case 'timeline-update':
      return {
        ...state,
        timeline: sortTasksByDeadline(
          state.timeline.map((task) =>
            task.id === action.id ? { ...task, ...action.patch } : task,
          ),
        ),
      };
    case 'timeline-add': {
      if (state.timeline.length >= LIMITS.maxTasks) return state;
      const offsetDays =
        action.dueDate && state.profile?.eventDate
          ? Math.round(
              (new Date(`${action.dueDate}T00:00:00Z`).getTime() -
                new Date(`${state.profile.eventDate}T00:00:00Z`).getTime()) /
                86_400_000,
            )
          : -1;
      const task: TimelineTask = {
        id: nextId('task'),
        title: action.title,
        description: action.description,
        dueDate: action.dueDate,
        relativeLabel: `${Math.abs(offsetDays)} days before`,
        offsetDays,
        priority: action.priority,
        status: 'pending',
      };
      return { ...state, timeline: sortTasksByDeadline([...state.timeline, task]) };
    }
    case 'timeline-delete':
      return { ...state, timeline: state.timeline.filter((task) => task.id !== action.id) };
    case 'checklist-toggle':
      return { ...state, checklist: toggleChecklistItem(state.checklist, action.id) };
    case 'checklist-update':
      return { ...state, checklist: updateChecklistItem(state.checklist, action.id, action.patch) };
    case 'checklist-add': {
      if (state.checklist.length >= LIMITS.maxTasks) return state;
      const item: ChecklistItem = {
        id: nextId('check'),
        title: action.title,
        section: action.section,
        priority: action.priority,
        dueDate: state.profile?.eventDate ?? null,
        relativeLabel: state.profile?.eventDate ? 'By event date' : 'No date set',
        status: 'pending',
      };
      return { ...state, checklist: addChecklistItem(state.checklist, item) };
    }
    case 'checklist-delete':
      return { ...state, checklist: removeChecklistItem(state.checklist, action.id) };
    case 'shortlist-toggle': {
      const shortlist = state.shortlist.includes(action.id)
        ? state.shortlist.filter((id) => id !== action.id)
        : [...state.shortlist, action.id];
      return { ...state, shortlist };
    }
    case 'set-ai-mode':
      return { ...state, aiMode: action.mode };
    case 'load-state':
      return action.state;
    case 'reset':
      clearState();
      return createInitialState();
    default:
      return state;
  }
}

interface MiraContextValue {
  state: AppState;
  busy: boolean;
  sendMessage: (text: string) => Promise<void>;
  createEvent: (category: EventCategory) => void;
  loadDemoScenario: (id: EventCategory) => void;
  patchProfile: (patch: Partial<EventProfile>) => void;
  dispatch: Dispatch<Action>;
  resetAll: () => void;
  progress: { done: number; total: number; percent: number };
  timelineStats: { done: number; total: number; overdue: number };
}

const MiraContext = createContext<MiraContextValue | null>(null);

export function MiraProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(
    reducer,
    undefined,
    () => loadState() ?? createInitialState(),
  );
  const [busy, setBusy] = useState(false);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    saveState(state);
  }, [state]);

  const sendMessage = useCallback(async (rawText: string) => {
    const text = validateText(rawText, LIMITS.maxMessageLength, 'Message');
    if (!text.ok || text.value === null) {
      dispatch({
        type: 'add-message',
        message: {
          id: nextId('err'),
          role: 'mira',
          text: text.errors[0] ?? 'That message could not be read.',
          kind: 'error',
          createdAt: Date.now(),
        },
      });
      return;
    }
    const message = text.value;
    dispatch({
      type: 'add-message',
      message: {
        id: nextId('user'),
        role: 'user',
        text: message,
        kind: 'normal',
        createdAt: Date.now(),
      },
    });

    let profile = stateRef.current.profile;
    if (!profile) {
      const category = detectCategory(message);
      if (!category) {
        dispatch({
          type: 'add-message',
          message: {
            id: nextId('mira'),
            role: 'mira',
            text: 'Which kind of celebration is this - a wedding, a birthday or a community event?',
            kind: 'normal',
            createdAt: Date.now(),
          },
        });
        return;
      }
      profile = createProfile(category);
      dispatch({ type: 'create-profile', profile });
    }

    setBusy(true);
    try {
      const history = stateRef.current.messages
        .slice(-6)
        .filter((entry) => entry.kind === 'normal')
        .map((entry) => ({ role: entry.role, text: entry.text }));
      const result = await planTurn(message, profile, { history });
      dispatch({ type: 'apply-turn', result });
    } finally {
      setBusy(false);
    }
  }, []);

  const createEvent = useCallback((category: EventCategory) => {
    dispatch({ type: 'create-profile', profile: createProfile(category) });
  }, []);

  const loadDemoScenario = useCallback((id: EventCategory) => {
    const scenario = demoScenarios().find((entry) => entry.id === id);
    if (scenario) dispatch({ type: 'load-state', state: buildDemoState(scenario) });
  }, []);

  const patchProfile = useCallback((patch: Partial<EventProfile>) => {
    if (patch.budgetINR !== undefined) {
      const budget = validateBudget(patch.budgetINR);
      if (!budget.ok) return;
    }
    if (patch.guestCount !== undefined) {
      const guests = validateGuestCount(patch.guestCount);
      if (!guests.ok) return;
    }
    if (patch.title !== undefined) {
      const title = validateText(patch.title, LIMITS.maxTitleLength, 'Title');
      if (!title.ok) return;
    }
    if (patch.location !== undefined) {
      const location = validateText(patch.location, LIMITS.maxLocationLength, 'Location', true);
      if (!location.ok) return;
    }
    if (patch.eventDate !== undefined && patch.eventDate !== null) {
      const date = validateEventDate(patch.eventDate);
      if (!date.ok) return;
    }
    dispatch({ type: 'patch-profile', patch });
  }, []);

  const resetAll = useCallback(() => {
    dispatch({ type: 'reset' });
  }, []);

  const value = useMemo<MiraContextValue>(() => {
    const progress = checklistProgress(state.checklist);
    const timelineStats = {
      ...timelineProgress(state.timeline),
      overdue: state.timeline.filter((task) => isOverdue(task)).length,
    };
    return {
      state,
      busy,
      sendMessage,
      createEvent,
      loadDemoScenario,
      patchProfile,
      dispatch,
      resetAll,
      progress,
      timelineStats,
    };
  }, [state, busy, sendMessage, createEvent, loadDemoScenario, patchProfile, resetAll]);

  return <MiraContext.Provider value={value}>{children}</MiraContext.Provider>;
}

export function useMira(): MiraContextValue {
  const context = useContext(MiraContext);
  if (!context) throw new Error('useMira must be used inside MiraProvider');
  return context;
}

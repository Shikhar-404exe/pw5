/**
 * Shared domain types for Mira.
 * All plan-producing logic flows through these structures so that UI, engines
 * and AI validation agree on one vocabulary.
 */

export type EventCategory = 'wedding' | 'birthday' | 'community';

export type Priority = 'high' | 'medium' | 'low';

export type TaskStatus = 'pending' | 'done';

/** Every budget line Mira can ever use, across all event categories. */
export const BUDGET_CATEGORY_KEYS = [
  'venue',
  'catering',
  'decoration',
  'photography',
  'clothing',
  'entertainment',
  'invitations',
  'transport',
  'cake',
  'permissions',
  'equipment',
  'publicity',
  'logistics',
  'misc',
] as const;

export type BudgetCategoryKey = (typeof BUDGET_CATEGORY_KEYS)[number];

export const EVENT_CATEGORIES: readonly EventCategory[] = ['wedding', 'birthday', 'community'];

/** The structured understanding of the user's celebration. */
export interface EventProfile {
  category: EventCategory;
  title: string;
  guestCount: number | null;
  budgetINR: number | null;
  location: string | null;
  /** ISO date yyyy-mm-dd, or null when the user has not decided. */
  eventDate: string | null;
  theme: string | null;
  /** Age group / audience where relevant (e.g. "kids", "seniors", "college"). */
  audience: string | null;
  priorities: Partial<Record<BudgetCategoryKey, Priority>>;
}

export type ChatRole = 'user' | 'mira';

export interface ChatMessage {
  id: string;
  role: ChatRole;
  text: string;
  /** Optional structured chips shown under the message. */
  notes?: string[];
  kind: 'normal' | 'notice' | 'error';
  createdAt: number;
}

export type ConceptStatus = 'suggested' | 'accepted' | 'rejected';

export interface EventConcept {
  id: string;
  title: string;
  description: string;
  theme: string;
  /** Hex colours for the mood board. */
  palette: string[];
  decorations: string[];
  food: string[];
  entertainment: string[];
  budgetImplication: string;
  considerations: string[];
  status: ConceptStatus;
  source: 'ai' | 'demo';
}

export interface BudgetLine {
  key: BudgetCategoryKey;
  label: string;
  allocatedINR: number;
  /** Benchmark estimate used for variance analysis — never presented as a confirmed price. */
  estimatedINR: number;
  isEstimate: boolean;
  userEdited: boolean;
}

export interface BudgetPlan {
  totalINR: number;
  lines: BudgetLine[];
}

export interface BudgetSummary {
  totalINR: number;
  allocatedINR: number;
  estimatedINR: number;
  remainingINR: number;
  /** estimated − allocated. Positive means the benchmark estimate is above what is allocated. */
  varianceINR: number;
  overBudget: boolean;
  overByINR: number;
  percentAllocated: number;
}

export interface TimelineTask {
  id: string;
  title: string;
  description: string;
  /** ISO date derived from the event date, or null in relative mode. */
  dueDate: string | null;
  /** Human label such as "60 days before" — always shown when the date is unknown. */
  relativeLabel: string;
  /** Negative = before the event day. */
  offsetDays: number;
  priority: Priority;
  status: TaskStatus;
}

export interface ChecklistItem {
  id: string;
  title: string;
  section: string;
  priority: Priority;
  dueDate: string | null;
  relativeLabel: string;
  status: TaskStatus;
}

export type VendorCategory =
  | 'venue'
  | 'caterer'
  | 'decorator'
  | 'photographer'
  | 'makeup'
  | 'entertainment'
  | 'coordinator'
  | 'rentals';

/**
 * Vendors are ALWAYS demonstration samples in this build.
 * No vendor-search provider is configured, so `isSample` is true for every entry
 * and the UI must label them accordingly.
 */
export interface Vendor {
  id: string;
  name: string;
  category: VendorCategory;
  location: string;
  description: string;
  priceRangeLabel: string | null;
  priceMinINR: number | null;
  priceMaxINR: number | null;
  /** Public rating is only ever shown when it comes from a real provider; samples have null. */
  rating: number | null;
  sourceUrl: string | null;
  verification: 'sample-demo' | 'estimated' | 'unverified';
  isSample: boolean;
}

export interface VendorFilters {
  category: VendorCategory | 'all';
  location: string | 'all';
  maxBudgetINR: number | null;
  minRating: number | null;
}

export type AiMode = 'demo' | 'ai' | 'unknown';

export interface AppState {
  /** null until the user starts or loads an event. */
  profile: EventProfile | null;
  messages: ChatMessage[];
  concepts: EventConcept[];
  budget: BudgetPlan | null;
  timeline: TimelineTask[];
  checklist: ChecklistItem[];
  shortlist: string[];
  aiMode: AiMode;
  /** The last plan the user explicitly generated, used to keep the plan and profile in sync. */
  planGeneratedAt: number | null;
}

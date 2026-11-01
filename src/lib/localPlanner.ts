/**
 * Local planner fallback.
 * When no AI provider is configured (demo mode), Mira still understands natural
 * language using deterministic parsing, and answers with structured confirmations.
 */

import type { BudgetCategoryKey, EventCategory, EventProfile, Priority } from '../types';
import { LIMITS, isValidIsoDate, parseCount } from './validation';

const CITY_PATTERN =
  /\b(delhi|delhi ncr|mumbai|bengaluru|bangalore|hyderabad|chennai|pune|kolkata|ahmedabad|jaipur|lucknow|indore|goa|chandigarh|kochi|surat|nagpur|bhopal|patna|coimbatore|agra|varanasi|udaipur|shimla|manali|rishikesh|gurgaon|noida)\b/i;

const THEME_WORDS: Record<string, string[]> = {
  'modern elegant': ['modern', 'elegant', 'sleek'],
  minimalist: ['minimalist', 'minimal', 'understated'],
  traditional: ['traditional', 'ethnic', 'classic'],
  rustic: ['rustic', 'earthy', 'barn'],
  luxury: ['luxury', 'luxurious', 'royal', 'opulent', 'grand'],
  sustainable: ['sustainable', 'eco-friendly', 'eco friendly', 'green'],
  retro: ['retro', 'vintage', '70s', '80s', '90s'],
  neon: ['neon', 'cyberpunk'],
  garden: ['garden', 'outdoor', 'lawn', 'open-air'],
  beach: ['beach', 'seaside', 'coastal'],
  boho: ['boho', 'bohemian'],
  'kids fantasy': ['kids', 'cartoon', 'superhero', 'princess', 'fairy'],
};

const MONTHS = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
];

const KEYWORD_MAP: Array<{ key: BudgetCategoryKey; pattern: RegExp }> = [
  { key: 'decoration', pattern: /decor|decoration|floral|flower|styling|setup/i },
  { key: 'photography', pattern: /photo|camera|candid|video|cinemat|shoot/i },
  { key: 'catering', pattern: /cater|food|menu|buffet|dining|snack/i },
  { key: 'venue', pattern: /venue|hall|space|location rental|banquet/i },
  { key: 'entertainment', pattern: /entertain|music|dj|band|game|dance|perform/i },
  { key: 'cake', pattern: /cake|dessert|sweet/i },
  { key: 'clothing', pattern: /cloth|outfit|attire|dress|makeup|stylist|jewel/i },
  { key: 'invitations', pattern: /invite|invitation|card|rsvp/i },
  { key: 'transport', pattern: /transport|car|bus|travel|shuttle/i },
  { key: 'permissions', pattern: /permission|permit|licen[cs]e/i },
  { key: 'equipment', pattern: /equipment|rental|sound|lighting|tent/i },
  { key: 'publicity', pattern: /publicity|marketing|poster|banner|social media/i },
  { key: 'logistics', pattern: /logistic|cleanup|security|parking/i },
];

export function detectCategory(text: string): EventCategory | null {
  if (/\b(wedding|shaadi|marriage|reception|sangeet|engagement|baraat|bridal)\b/i.test(text)) {
    return 'wedding';
  }
  if (/\b(birthday|bday|cake smash|surprise party|turned?\s+\d+|year[- ]old)\b/i.test(text)) {
    return 'birthday';
  }
  if (
    /\b(community|public event|fundraiser|charity|festival|mela|college fest|neighborhood|neighbourhood|awareness|volunteer|local event)\b/i.test(
      text,
    )
  ) {
    return 'community';
  }
  return null;
}

export function parseGuestCount(text: string): number | null {
  const direct = text.match(/(\d[\d,]*)\s*(?:\+)?\s*(?:guests?|people|pax|attendees?|invitees)\b/i);
  if (direct?.[1]) {
    const value = parseCount(direct[1]);
    if (value !== null && value >= 1 && value <= LIMITS.maxGuestCount) return value;
  }
  const labelled = text.match(/(?:headcount|guest\s*count|attendance|capacity)\D{0,12}(\d[\d,]*)/i);
  if (labelled?.[1]) {
    const value = parseCount(labelled[1]);
    if (value !== null && value >= 1 && value <= LIMITS.maxGuestCount) return value;
  }
  return null;
}

function toINR(value: number, unit: string | undefined): number {
  const u = (unit ?? '').toLowerCase();
  if (u.startsWith('cr')) return Math.round(value * 10_000_000);
  if (u.startsWith('l') || u === 'thousand')
    return Math.round(value * (u === 'thousand' ? 1000 : 100_000));
  if (u === 'k') return Math.round(value * 1000);
  return Math.round(value);
}

export function parseBudgetINR(text: string): number | null {
  const patterns: RegExp[] = [
    /(?:₹|rs\.?\s*|inr\s*)(\d[\d.,]*)\s*(crore|cr|lakh|lakhs|lac|l|k|thousand)?/i,
    /(\d[\d.,]*)\s*(crore|cr|lakh|lakhs|lac|k|thousand)\b/i,
    /budget(?:\s+(?:of|is|around|about|under|below|nearly))?\s*[:-]?\s*(?:₹|rs\.?\s*|inr\s*)?(\d[\d.,]*)\b(?![- ]?(guest|people|pax|attendees))/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      // Keep decimals here: "1.5 lakh" must not become "1 lakh".
      const value = Number(match[1].replace(/,/g, ''));
      if (Number.isFinite(value) && value >= 1 && value <= LIMITS.maxBudgetINR) {
        return toINR(value, match[2]);
      }
    }
  }
  return null;
}

export function parseEventDate(text: string, today: Date = new Date()): string | null {
  const iso = text.match(/(\d{4}-\d{2}-\d{2})/);
  if (iso?.[1] && isValidIsoDate(iso[1])) return iso[1];

  const relative = text.match(/\bin\s+(\d{1,3})\s*(day|days|week|weeks|month|months)\b/i);
  if (relative?.[1] && relative[2]) {
    const amount = Number(relative[1]);
    const unit = relative[2].toLowerCase();
    const date = new Date(today.getTime());
    if (unit.startsWith('day')) date.setDate(date.getDate() + amount);
    else if (unit.startsWith('week')) date.setDate(date.getDate() + amount * 7);
    else date.setMonth(date.getMonth() + amount);
    return date.toISOString().slice(0, 10);
  }
  if (/\bnext month\b/i.test(text)) {
    const date = new Date(today.getTime());
    date.setMonth(date.getMonth() + 1);
    return date.toISOString().slice(0, 10);
  }

  // Scan every "<day> <month>" candidate; only a real month name counts.
  for (const named of text.matchAll(/\b(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]+)(?:\s+(\d{4}))?\b/gi)) {
    const day = Number(named[1]);
    if (!named[2] || day < 1 || day > 31) continue;
    const monthPrefix = named[2].toLowerCase().slice(0, 3);
    const month = MONTHS.findIndex((month) => month.startsWith(monthPrefix));
    if (month < 0) continue;
    let year = named[3] ? Number(named[3]) : today.getUTCFullYear();
    if (!named[3]) {
      const candidate = Date.UTC(year, month, day);
      if (candidate < today.getTime()) year += 1;
    }
    const isoCandidate = new Date(Date.UTC(year, month, day)).toISOString().slice(0, 10);
    if (isValidIsoDate(isoCandidate)) return isoCandidate;
  }
  return null;
}

export function parseLocation(text: string): string | null {
  const city = text.match(CITY_PATTERN);
  if (city?.[0]) {
    const found = city[0];
    // Normalise casing to Title Case.
    return found
      .toLowerCase()
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
  return null;
}

export function parseTheme(text: string): string | null {
  const labelled = text.match(
    /(?:theme|style|vibe|aesthetic)\s*(?:of|is|:|=|like)?\s*([^.,;!?\n]{3,50})/i,
  );
  if (labelled?.[1]) {
    const value = labelled[1]
      .trim()
      .replace(/^(?:to|is|like)\s+/i, '')
      .replace(/\s+(?:with|then)$/i, '');
    if (value.length >= 3) return value.slice(0, 50);
  }
  const matched: string[] = [];
  const lower = text.toLowerCase();
  for (const [theme, words] of Object.entries(THEME_WORDS)) {
    if (words.some((word) => lower.includes(word))) matched.push(theme);
  }
  if (matched.length > 0) return matched.slice(0, 2).join(' + ');
  return null;
}

export function parseAudience(text: string): string | null {
  const age = text.match(/(\d{1,2})\s*[- ]?\s*year[- ]olds?/i);
  if (age?.[1]) return `${age[1]} year olds`;
  const group = text.match(
    /\b(kids|children|teenagers?|teens|college students|students|seniors|elderly|corporate|family and friends)\b/i,
  );
  return group?.[0] ? group[0].toLowerCase() : null;
}

export function matchCategoryKey(phrase: string): BudgetCategoryKey | null {
  const entry = KEYWORD_MAP.find(({ pattern }) => pattern.test(phrase));
  return entry ? entry.key : null;
}

/** Understands "reduce decoration and put more into photography" style refinements. */
export function parsePriorityChanges(text: string): Partial<Record<BudgetCategoryKey, Priority>> {
  const changes: Partial<Record<BudgetCategoryKey, Priority>> = {};
  const downMatches = text.matchAll(
    /\b(?:reduce|decrease|cut|lower|trim|scale back|save on|spend less on)\b(?:\s+(?:the|our|my))?\s+([a-z][a-z\s&]{1,30}?)(?=\s+(?:and|,|;)|\s*$)/gi,
  );
  for (const match of downMatches) {
    if (match[1]) {
      const key = matchCategoryKey(match[1]);
      if (key) changes[key] = 'low';
    }
  }
  const upMatches = text.matchAll(
    /\b(?:increase|boost|raise|expand|add more(?:\s+money)?(?:\s+to|\s+on)?|allocate more(?:\s+money)?(?:\s+to)?|spend more(?:\s+money)?(?:\s+on|to)?)\b\s+([a-z][a-z\s&]{1,30}?)(?=\s+(?:and|,|;)|\s*$)/gi,
  );
  for (const match of upMatches) {
    if (match[1]) {
      const key = matchCategoryKey(match[1]);
      if (key) changes[key] = 'high';
    }
  }
  return changes;
}

export interface PlanIntents {
  wantsIdeas: boolean;
  wantsBudget: boolean;
  wantsTimeline: boolean;
  wantsChecklist: boolean;
  wantsVendors: boolean;
  wantsAll: boolean;
}

export function detectIntents(text: string): PlanIntents {
  const wantsAll =
    /\b(generate\s+(my\s+)?plan|plan\s+my\s+(event|wedding|birthday)|full\s+plan|complete\s+plan)\b/i.test(
      text,
    );
  return {
    wantsAll,
    wantsIdeas:
      wantsAll || /\b(idea|concept|theme suggestion|inspire|decor idea|suggest)\b/i.test(text),
    wantsBudget: wantsAll || /\b(budget|allocat|expense|cost split|spending plan)\b/i.test(text),
    wantsTimeline:
      wantsAll || /\b(timeline|schedule|deadline|preparation plan|milestone)\b/i.test(text),
    wantsChecklist: wantsAll || /\b(checklist|to-?do|tasks|action items)\b/i.test(text),
    wantsVendors:
      wantsAll || /\b(vendor|supplier|caterer|photographer|decorator|booking)\b/i.test(text),
  };
}

/** Essential details still missing from the profile, phrased as questions. */
export function missingEssentials(profile: EventProfile): string[] {
  const questions: string[] = [];
  if (profile.guestCount === null) questions.push('How many guests are you expecting?');
  if (profile.budgetINR === null) questions.push('What is your total budget?');
  if (profile.eventDate === null)
    questions.push('When is the event (a date, or roughly how many days away)?');
  if (profile.location === null) questions.push('Which city or area is the venue in?');
  if (profile.theme === null) questions.push('Do you have a theme or style in mind?');
  return questions.slice(0, 3);
}

export function defaultTitle(profile: EventProfile): string {
  const categoryLabel =
    profile.category === 'wedding'
      ? 'Wedding'
      : profile.category === 'birthday'
        ? 'Birthday'
        : 'Community event';
  const place = profile.location ? ` in ${profile.location}` : '';
  return `${categoryLabel}${place}`;
}

export interface LocalTurn {
  delta: Partial<EventProfile>;
  priorityChanges: Partial<Record<BudgetCategoryKey, Priority>>;
  questions: string[];
  intents: PlanIntents;
  reply: string;
  notes: string[];
}

function describeChange(label: string, from: unknown, to: unknown): string | null {
  if (to === null || to === undefined) return null;
  if (String(from ?? 'not set') === String(to)) return null;
  return `${label}: ${String(to)}`;
}

/**
 * Deterministically interpret a user message against the current profile.
 * Only mentioned fields change; everything else is preserved (conversation memory).
 */
export function buildLocalTurn(
  message: string,
  profile: EventProfile,
  today: Date = new Date(),
): LocalTurn {
  const delta: Partial<EventProfile> = {};
  const changes: string[] = [];
  const note = (label: string, from: unknown, to: unknown): void => {
    const change = describeChange(label, from, to);
    if (change) changes.push(change);
  };

  const category = detectCategory(message);
  if (category && category !== profile.category) {
    delta.category = category;
    note('Event type', profile.category, category);
  }
  const guests = parseGuestCount(message);
  if (guests !== null && guests !== profile.guestCount) {
    delta.guestCount = guests;
    note('Guests', profile.guestCount, guests);
  }
  const budget = parseBudgetINR(message);
  if (budget !== null && budget !== profile.budgetINR) {
    delta.budgetINR = budget;
    note('Budget', profile.budgetINR, budget);
  }
  const date = parseEventDate(message, today);
  if (date !== null && date !== profile.eventDate) {
    delta.eventDate = date;
    note('Date', profile.eventDate, date);
  }
  const location = parseLocation(message);
  if (location !== null && location !== profile.location) {
    delta.location = location;
    note('Location', profile.location, location);
  }
  const theme = parseTheme(message);
  if (theme !== null && theme !== profile.theme) {
    delta.theme = theme;
    note('Theme', profile.theme, theme);
  }
  const audience = parseAudience(message);
  if (audience !== null && audience !== profile.audience) {
    delta.audience = audience;
  }
  if ((delta.category ?? profile.category) !== profile.category || !profile.title) {
    const merged: EventProfile = { ...profile, ...delta } as EventProfile;
    delta.title = defaultTitle(merged);
  }

  const priorityChanges = parsePriorityChanges(message);
  const intents = detectIntents(message);

  const merged: EventProfile = { ...profile, ...delta } as EventProfile;
  const questions = missingEssentials(merged);
  const notes: string[] = ['Estimates are indicative, not confirmed prices.'];

  let reply: string;
  const summaryParts = changes.filter((change): change is string => change !== null);
  const priorityParts = Object.entries(priorityChanges).map(([key, value]) => `${key} -> ${value}`);
  if (summaryParts.length > 0 || priorityParts.length > 0) {
    reply = `Noted. ${[...summaryParts, ...priorityParts].join('; ')}. Everything else stays as it was.`;
  } else if (questions.length > 0) {
    reply = `I can plan that. ${questions.join(' ')}`;
  } else {
    reply =
      'I have your event details. Ask me for ideas, a budget split, a timeline, vendor categories or a checklist - or say "generate my plan" for everything at once.';
  }
  if (intents.wantsAll || intents.wantsBudget) {
    reply +=
      ' Reminder: budget numbers are calculated in the app itself, so the split will always add up to your total.';
  }

  return { delta, priorityChanges, questions, intents, reply, notes };
}

/**
 * Deterministic personalised-ideas engine.
 * Used as the clearly-labelled demo fallback when no AI provider is configured,
 * and to sanity-check/supplement AI concepts.
 */

import type { BudgetPlan, EventConcept, EventProfile } from '../types';
import { summarizeBudget } from './budget';

interface Palette {
  name: string;
  colors: string[];
}

const PALETTES: Record<string, Palette> = {
  'modern elegant': {
    name: 'Charcoal & pearl',
    colors: ['#23252B', '#8E8AA0', '#E9E6DE', '#4C6FFF'],
  },
  minimalist: { name: 'Ivory & graphite', colors: ['#1C1E22', '#6E7178', '#F2F0EB', '#C9C4B8'] },
  traditional: { name: 'Marigold & crimson', colors: ['#8C2B22', '#E0912F', '#F4E3C8', '#3E5F44'] },
  sustainable: { name: 'Sage & clay', colors: ['#4E6A50', '#B98B5E', '#EDE7D9', '#7A9E9F'] },
  luxury: { name: 'Onyx & gold', colors: ['#14151A', '#C9A227', '#EFE9DA', '#5C3A6E'] },
  festive: { name: 'Violet & cyan', colors: ['#5B2A86', '#1FA7C4', '#F6E7C1', '#E2545B'] },
  playful: { name: 'Tangerine & teal', colors: ['#F26B3A', '#128C8C', '#FBE3C2', '#5C4B8A'] },
  default: {
    name: 'Graphite & electric blue',
    colors: ['#20232A', '#4C6FFF', '#D8D6CE', '#33B5C9'],
  },
};

function pickPalette(theme: string | null): Palette {
  if (!theme) return PALETTES.default as Palette;
  const t = theme.toLowerCase();
  if (/modern|elegant|sleek/.test(t)) return PALETTES['modern elegant'] as Palette;
  if (/minimal|simple|clean/.test(t)) return PALETTES.minimalist as Palette;
  if (/traditional|ethnic|classic|indian/.test(t)) return PALETTES.traditional as Palette;
  if (/sustain|eco|green|organic/.test(t)) return PALETTES.sustainable as Palette;
  if (/luxur|royal|opulent|glam/.test(t)) return PALETTES.luxury as Palette;
  if (/festive|cultural|colour|colorful/.test(t)) return PALETTES.festive as Palette;
  if (/fun|playful|cartoon|kids|comic/.test(t)) return PALETTES.playful as Palette;
  return PALETTES.default as Palette;
}

function money(budgetINR: number | null): string {
  if (budgetINR === null) return 'budget not set yet';
  if (budgetINR >= 100_000)
    return `${(budgetINR / 100_000).toFixed(budgetINR % 100_000 === 0 ? 0 : 1)} lakh`;
  return `${Math.round(budgetINR / 1000)} thousand`;
}

function scaleNote(profile: EventProfile, plan: BudgetPlan | null): string {
  const guests = profile.guestCount;
  const budget = money(profile.budgetINR);
  if (!plan)
    return `Planned for around ${guests ?? 'an unknown number of'} guests within ${budget}.`;
  const summary = summarizeBudget(plan);
  const perGuest =
    guests && summary.totalINR > 0
      ? ` (about ${Math.round(summary.totalINR / guests)} per guest)`
      : '';
  return `Planned for around ${guests ?? 'an unknown number of'} guests within ${budget}${perGuest}.`;
}

interface Archetype {
  suffix: string;
  title: string;
  description: string;
  decorations: string[];
  food: string[];
  entertainment: string[];
  considerations: string[];
}

const ARCHETYPES: Record<string, Archetype[]> = {
  wedding: [
    {
      suffix: 'modern-elegance',
      title: 'Modern Elegance Reception',
      description:
        'Clean lines, sculpted florals and a candlelit dinner that feels editorial yet warm.',
      decorations: [
        'Floral arch with seasonal blooms',
        'Warm uplighting on feature walls',
        'Minimal table runners with taper candles',
      ],
      food: [
        'Three-course plated dinner',
        'Live chaat or dessert counter',
        'Signature mocktail named after the couple',
      ],
      entertainment: ['Acoustic duo during cocktails', 'Curated first-dance playlist'],
      considerations: [
        'Confirm noise cut-off timings with the venue',
        'Plan a rain backup for outdoor photos',
      ],
    },
    {
      suffix: 'intimate-auras',
      title: 'Intimate Candlelight Wedding',
      description:
        'A close-knit celebration with long-table seating, layered textiles and unhurried conversation.',
      decorations: [
        'Long communal tables with garlands',
        'Fairy-light canopy',
        'Handwritten place cards',
      ],
      food: [
        'Family-style sharing platters',
        'Regional comfort menu',
        'Late-night chai and dessert stall',
      ],
      entertainment: ['Solo instrumentalist', 'Open mic for family toasts'],
      considerations: ['Works best under 120 guests', 'Budget more per guest for premium menu'],
    },
    {
      suffix: 'heritage-soiree',
      title: 'Heritage Courtyard Wedding',
      description:
        'Traditional rituals staged in a haveli-style courtyard with folk textures and warm brass.',
      decorations: [
        'Marigold torans and brass lamps',
        'Patterned floor seating for ceremonies',
        'Hand-painted signage',
      ],
      food: [
        'Regional thali service',
        'Traditional sweets counter',
        'Buttermilk and sherbet stations',
      ],
      entertainment: ['Folk dancers for the baraat', 'Dhol performance'],
      considerations: [
        'Requires heritage venue permissions',
        'Add fan or misting setup for summer dates',
      ],
    },
  ],
  birthday: [
    {
      suffix: 'signature-themes',
      title: 'Signature Themed Birthday',
      description:
        'One strong theme carried through décor, cake and dress code for a celebration with real personality.',
      decorations: [
        'Statement entrance arch in theme colours',
        'Photo booth with themed props',
        'Customised balloon installation',
      ],
      food: [
        'Theme-matched snack stations',
        'Build-your-own dessert bar',
        'Colour-coordinated cake',
      ],
      entertainment: ['Costume contest with small prizes', 'Curated playlist with a dance floor'],
      considerations: [
        'Pick a theme your guest list will enjoy',
        'Confirm prop cleanup charges with the venue',
      ],
    },
    {
      suffix: 'surprise-unveil',
      title: 'Surprise Reveal Party',
      description:
        'A covertly planned reveal with a decoy plan, coordinated arrival windows and a big entrance moment.',
      decorations: [
        'Hidden decor until the reveal moment',
        'Countdown screen',
        'Confetti or balloon drop',
      ],
      food: [
        'Finger-food-heavy menu for mingling',
        'Signature cocktail or mocktail',
        'Cake timed to the reveal',
      ],
      entertainment: ['Video montage of messages from friends', 'Host-led reveal sequence'],
      considerations: [
        'Share a strict arrival time, not the real one',
        'Assign one person to keep the guest of honour on schedule',
      ],
    },
    {
      suffix: 'outdoor-fête',
      title: 'Outdoor Garden Fête',
      description:
        'A relaxed open-air celebration with lawn games, picnic zones and golden-hour photos.',
      decorations: [
        'Festoon lighting across the lawn',
        'Low seating with cushions and rugs',
        'Fresh flower table accents',
      ],
      food: [
        'Live grill or pizza station',
        'Fresh juices and coolers',
        'Handheld desserts easy to eat standing',
      ],
      entertainment: ['Lawn games: cornhole, ring toss', 'Acoustic live set at sunset'],
      considerations: [
        'Always confirm a rain venue',
        'Budget for generator backup and insect control',
      ],
    },
  ],
  community: [
    {
      suffix: 'culture-mela',
      title: 'Community Culture Mela',
      description:
        'A neighbourhood showcase of food, craft and performance that brings every age group together.',
      decorations: [
        'Bunting and rangoli entrance',
        'Stage backdrop with local art',
        'Volunteer-led signage',
      ],
      food: [
        'Local home-chef food stalls',
        'Affordable set-price plates',
        'Drinking-water stations',
      ],
      entertainment: ['Local school and troupe performances', 'Open stage slots for residents'],
      considerations: ['Confirm municipal permissions early', 'Plan volunteer shifts with breaks'],
    },
    {
      suffix: 'fundraiser-gala',
      title: 'Charity Fundraiser Evening',
      description:
        'A cause-first evening with a clear donation flow, sponsor recognition and a short program.',
      decorations: [
        'Sponsor wall and cause banner',
        'Donation QR stations',
        'Simple stage with good lighting',
      ],
      food: [
        'Sponsored or cost-recovered catering',
        'Ticketed set menu',
        'Volunteer-run beverage counter',
      ],
      entertainment: ['Short keynote and beneficiary stories', 'Live auction or pledge segment'],
      considerations: [
        'Keep finances transparent with public receipts',
        'Confirm donation compliance norms',
      ],
    },
    {
      suffix: 'awareness-jatha',
      title: 'Awareness Walk & Gathering',
      description:
        'A focused public-awareness event with a walk, stalls and a short closing ceremony.',
      decorations: [
        'Banner and placard station',
        'Branded ribbons and badges',
        'Stall canopy setup',
      ],
      food: ['Hydration and light-snack stalls', 'Volunteer-packed snack boxes'],
      entertainment: ['Street plays or skits on the cause', 'Community pledge wall'],
      considerations: [
        'Route permission and traffic coordination required',
        'First-aid volunteer on standby',
      ],
    },
  ],
};

export function conceptId(profile: EventProfile, suffix: string): string {
  return `${profile.category}-${suffix}`;
}

/** Generate 3 personalised concepts deterministically. Labelled 'demo' source. */
export function generateConcepts(profile: EventProfile, plan: BudgetPlan | null): EventConcept[] {
  const palette = pickPalette(profile.theme);
  const location = profile.location ? ` in ${profile.location}` : '';
  const scale = scaleNote(profile, plan);
  return (ARCHETYPES[profile.category] ?? []).map((archetype) => ({
    id: conceptId(profile, archetype.suffix),
    title: archetype.title,
    description: `${archetype.description}${location ? ` Styled for ${profile.theme ?? 'your preferences'}${location}.` : ''}`,
    theme: profile.theme ?? palette.name,
    palette: palette.colors,
    decorations: archetype.decorations,
    food: archetype.food,
    entertainment: archetype.entertainment,
    budgetImplication: scale,
    considerations: archetype.considerations,
    status: 'suggested',
    source: 'demo',
  }));
}

/** Regenerate a concept with a new theme without touching rejected ones. */
export function refineConcept(
  concept: EventConcept,
  profile: EventProfile,
  plan: BudgetPlan | null,
): EventConcept {
  const palette = pickPalette(profile.theme);
  return {
    ...concept,
    theme: profile.theme ?? palette.name,
    palette: palette.colors,
    budgetImplication: scaleNote(profile, plan),
    source: 'demo',
  };
}

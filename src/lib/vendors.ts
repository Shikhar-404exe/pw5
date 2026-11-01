/**
 * Vendor discovery and organisation.
 *
 * ACCURACY NOTE: no vendor-search provider is configured for this build, so every
 * entry below is a DEMONSTRATION SAMPLE. Names are fictional, ratings are null and
 * no price is ever presented as confirmed. The UI must always display the sample label.
 */

import type { Vendor, VendorCategory, VendorFilters } from '../types';
import { clampInt } from './validation';

export const VENDOR_CATEGORY_LABELS: Record<VendorCategory, string> = {
  venue: 'Venue',
  caterer: 'Caterer',
  decorator: 'Decorator',
  photographer: 'Photographer',
  makeup: 'Makeup artist',
  entertainment: 'Entertainment',
  coordinator: 'Event coordinator',
  rentals: 'Rental services',
};

function sample(
  id: string,
  name: string,
  category: VendorCategory,
  location: string,
  description: string,
  priceMinINR: number | null,
  priceMaxINR: number | null,
): Vendor {
  const priceRangeLabel =
    priceMinINR !== null && priceMaxINR !== null
      ? `Sample estimate: ${Math.round(priceMinINR / 1000)}k-${Math.round(priceMaxINR / 1000)}k INR`
      : null;
  return {
    id,
    name,
    category,
    location,
    description,
    priceRangeLabel,
    priceMinINR,
    priceMaxINR,
    rating: null,
    sourceUrl: null,
    verification: 'sample-demo',
    isSample: true,
  };
}

export const SAMPLE_VENDORS: Vendor[] = [
  sample(
    'v-venue-1',
    'Lotus Courtyard (sample)',
    'venue',
    'Delhi NCR',
    'Banquet-style hall with capacity up to 350 guests, in-house catering partner.',
    150_000,
    400_000,
  ),
  sample(
    'v-venue-2',
    'Skyline Terrace (sample)',
    'venue',
    'Mumbai',
    'Rooftop venue for evening receptions with city views, monsoon cover available.',
    250_000,
    700_000,
  ),
  sample(
    'v-venue-3',
    'Amber Lawns (sample)',
    'venue',
    'Jaipur',
    'Open-air lawn with heritage-style facade, suited to weddings and melas.',
    120_000,
    350_000,
  ),
  sample(
    'v-venue-4',
    'Maple Community Hall (sample)',
    'venue',
    'Bengaluru',
    'Mid-size hall with stage, projector and accessible entry, hourly rental.',
    40_000,
    120_000,
  ),
  sample(
    'v-cat-1',
    'Spice Route Caterers (sample)',
    'caterer',
    'Delhi NCR',
    'Multi-cuisine buffet and plated service, tasting sessions included.',
    650,
    1200,
  ),
  sample(
    'v-cat-2',
    'Firewood Kitchen (sample)',
    'caterer',
    'Pune',
    'Live counters and wood-fired pizza station for casual celebrations.',
    450,
    900,
  ),
  sample(
    'v-cat-3',
    'Annapurna Home Chefs (sample)',
    'caterer',
    'Hyderabad',
    'Regional home-style menu for community gatherings, per-plate pricing.',
    250,
    550,
  ),
  sample(
    'v-dec-1',
    'Petal & Pane (sample)',
    'decorator',
    'Delhi NCR',
    'Floral installations, stage design and lighting for modern receptions.',
    80_000,
    300_000,
  ),
  sample(
    'v-dec-2',
    'Rangoli Works (sample)',
    'decorator',
    'Ahmedabad',
    'Traditional decor with handcrafted elements and folk textiles.',
    40_000,
    150_000,
  ),
  sample(
    'v-dec-3',
    'Neon & Nest (sample)',
    'decorator',
    'Mumbai',
    'Contemporary styling, neon signage and photo-booth setups.',
    60_000,
    250_000,
  ),
  sample(
    'v-ph-1',
    'Golden Hour Studio (sample)',
    'photographer',
    'Delhi NCR',
    'Wedding photography and cinematography, two-shooter team.',
    80_000,
    250_000,
  ),
  sample(
    'v-ph-2',
    'Framefolk (sample)',
    'photographer',
    'Bengaluru',
    'Candid event coverage and next-day highlight edits.',
    35_000,
    90_000,
  ),
  sample(
    'v-mu-1',
    'Studio Glow (sample)',
    'makeup',
    'Mumbai',
    'Bridal and family makeup with trial session, on-location service.',
    25_000,
    80_000,
  ),
  sample(
    'v-mu-2',
    'Everyday Elegance (sample)',
    'makeup',
    'Delhi NCR',
    'Party makeup and hairstyling for small groups.',
    8_000,
    30_000,
  ),
  sample(
    'v-ent-1',
    'Echo Sound Systems (sample)',
    'entertainment',
    'Delhi NCR',
    'DJ, sound and stage lighting packages with operator.',
    30_000,
    120_000,
  ),
  sample(
    'v-ent-2',
    'Folk Beats Troupe (sample)',
    'entertainment',
    'Jaipur',
    'Dhol and folk performance for baraat or mela openings.',
    15_000,
    50_000,
  ),
  sample(
    'v-ent-3',
    'Campus Crew Band (sample)',
    'entertainment',
    'Bengaluru',
    'Acoustic and cover band for birthdays and college fests.',
    20_000,
    60_000,
  ),
  sample(
    'v-co-1',
    'PlanIt Partners (sample)',
    'coordinator',
    'Delhi NCR',
    'Full-service coordination, vendor management and run-sheet handling.',
    75_000,
    300_000,
  ),
  sample(
    'v-co-2',
    'DayOf Dynamics (sample)',
    'coordinator',
    'Mumbai',
    'Day-of coordination only, up to 10 hours on site.',
    25_000,
    60_000,
  ),
  sample(
    'v-rent-1',
    'Seat & Shade Rentals (sample)',
    'rentals',
    'Delhi NCR',
    'Chairs, tables, canopies and cold-storage rental with delivery.',
    20_000,
    90_000,
  ),
  sample(
    'v-rent-2',
    'Festive Supply Co. (sample)',
    'rentals',
    'Pune',
    'Tents, lighting rigs, generators and cleanup equipment.',
    15_000,
    70_000,
  ),
];

export function filterVendors(vendors: Vendor[], filters: VendorFilters): Vendor[] {
  return vendors.filter((vendor) => {
    if (filters.category !== 'all' && vendor.category !== filters.category) return false;
    if (filters.location !== 'all' && vendor.location !== filters.location) return false;
    if (filters.minRating !== null) {
      // Samples carry no rating, so they can never satisfy a rating filter.
      if (vendor.rating === null || vendor.rating < filters.minRating) return false;
    }
    if (filters.maxBudgetINR !== null && vendor.priceMaxINR !== null) {
      if (vendor.priceMaxINR > filters.maxBudgetINR) return false;
    }
    return true;
  });
}

export function vendorLocations(vendors: Vendor[]): string[] {
  return [...new Set(vendors.map((vendor) => vendor.location))].sort();
}

/**
 * Validate vendor records coming from any external source.
 * Returns null when the record is not safe to display (missing identity, bad ranges, junk URLs).
 */
export function validateVendor(raw: unknown): Vendor | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const record = raw as Record<string, unknown>;
  const name = typeof record.name === 'string' ? record.name.trim() : '';
  if (name.length === 0 || name.length > 100) return null;
  const category = record.category;
  if (typeof category !== 'string' || !(category in VENDOR_CATEGORY_LABELS)) return null;
  const location = typeof record.location === 'string' ? record.location.trim() : '';
  if (location.length === 0 || location.length > 80) return null;
  const description = typeof record.description === 'string' ? record.description.trim() : '';
  if (description.length > 500) return null;
  let priceMinINR: number | null = null;
  let priceMaxINR: number | null = null;
  if (typeof record.priceMinINR === 'number' && Number.isFinite(record.priceMinINR)) {
    priceMinINR = clampInt(record.priceMinINR, 0, 100_000_000);
  }
  if (typeof record.priceMaxINR === 'number' && Number.isFinite(record.priceMaxINR)) {
    priceMaxINR = clampInt(record.priceMaxINR, 0, 100_000_000);
  }
  if (priceMinINR !== null && priceMaxINR !== null && priceMinINR > priceMaxINR) return null;
  let rating: number | null = null;
  if (
    typeof record.rating === 'number' &&
    Number.isFinite(record.rating) &&
    record.rating >= 0 &&
    record.rating <= 5
  ) {
    rating = record.rating;
  }
  let sourceUrl: string | null = null;
  if (typeof record.sourceUrl === 'string' && /^https:\/\//.test(record.sourceUrl)) {
    sourceUrl = record.sourceUrl.slice(0, 300);
  }
  const isSample = record.isSample !== false; // default to sample when unproven
  return {
    id:
      typeof record.id === 'string' && record.id.length <= 60
        ? record.id
        : `ext-${name.toLowerCase().replace(/\W+/g, '-')}`,
    name,
    category: category as VendorCategory,
    location,
    description,
    priceRangeLabel:
      priceMinINR !== null && priceMaxINR !== null
        ? `Estimate: ${Math.round(priceMinINR / 1000)}k-${Math.round(priceMaxINR / 1000)}k INR`
        : null,
    priceMinINR,
    priceMaxINR,
    rating,
    sourceUrl,
    verification: isSample
      ? 'sample-demo'
      : rating !== null || sourceUrl !== null
        ? 'estimated'
        : 'unverified',
    isSample,
  };
}

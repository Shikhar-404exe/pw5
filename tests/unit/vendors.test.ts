import { describe, expect, it } from 'vitest';
import {
  SAMPLE_VENDORS,
  VENDOR_CATEGORY_LABELS,
  filterVendors,
  validateVendor,
  vendorLocations,
} from '../../src/lib/vendors';

describe('sample vendor data', () => {
  it('labels every sample as demonstration data with no fabricated ratings', () => {
    expect(SAMPLE_VENDORS.length).toBeGreaterThanOrEqual(15);
    for (const vendor of SAMPLE_VENDORS) {
      expect(vendor.isSample).toBe(true);
      expect(vendor.verification).toBe('sample-demo');
      expect(vendor.rating).toBeNull();
      expect(vendor.sourceUrl).toBeNull();
      expect(vendor.name.toLowerCase()).toContain('sample');
    }
  });

  it('covers all eight vendor categories', () => {
    const categories = new Set(SAMPLE_VENDORS.map((vendor) => vendor.category));
    expect(categories.size).toBe(Object.keys(VENDOR_CATEGORY_LABELS).length);
  });
});

describe('filterVendors', () => {
  it('filters by category', () => {
    const venues = filterVendors(SAMPLE_VENDORS, {
      category: 'venue',
      location: 'all',
      maxBudgetINR: null,
      minRating: null,
    });
    expect(venues.length).toBeGreaterThan(0);
    expect(venues.every((vendor) => vendor.category === 'venue')).toBe(true);
  });

  it('filters by location', () => {
    const delhi = filterVendors(SAMPLE_VENDORS, {
      category: 'all',
      location: 'Delhi NCR',
      maxBudgetINR: null,
      minRating: null,
    });
    expect(delhi.length).toBeGreaterThan(0);
    expect(delhi.every((vendor) => vendor.location === 'Delhi NCR')).toBe(true);
  });

  it('filters by maximum price', () => {
    const cheap = filterVendors(SAMPLE_VENDORS, {
      category: 'all',
      location: 'all',
      maxBudgetINR: 50_000,
      minRating: null,
    });
    expect(
      cheap.every((vendor) => vendor.priceMaxINR === null || vendor.priceMaxINR <= 50_000),
    ).toBe(true);
  });

  it('never satisfies a rating filter with samples (no fabricated ratings)', () => {
    const rated = filterVendors(SAMPLE_VENDORS, {
      category: 'all',
      location: 'all',
      maxBudgetINR: null,
      minRating: 3,
    });
    expect(rated).toEqual([]);
  });

  it('returns everything with neutral filters', () => {
    expect(
      filterVendors(SAMPLE_VENDORS, {
        category: 'all',
        location: 'all',
        maxBudgetINR: null,
        minRating: null,
      }),
    ).toEqual(SAMPLE_VENDORS);
  });
});

describe('vendorLocations', () => {
  it('lists unique sorted locations', () => {
    const locations = vendorLocations(SAMPLE_VENDORS);
    expect(new Set(locations).size).toBe(locations.length);
    expect([...locations].sort()).toEqual(locations);
  });
});

describe('validateVendor', () => {
  const valid = {
    id: 'ext-1',
    name: 'Sunset Studios',
    category: 'photographer',
    location: 'Pune',
    description: 'Event photography.',
    priceMinINR: 20_000,
    priceMaxINR: 80_000,
    rating: 4.5,
    sourceUrl: 'https://example.com/studios',
    isSample: false,
  };

  it('accepts a well-formed external record', () => {
    const vendor = validateVendor(valid);
    expect(vendor).not.toBeNull();
    expect(vendor!.name).toBe('Sunset Studios');
    expect(vendor!.priceRangeLabel).toContain('Estimate');
  });

  it('rejects missing identity or unknown categories', () => {
    expect(validateVendor({ ...valid, name: '  ' })).toBeNull();
    expect(validateVendor({ ...valid, category: 'astrologer' })).toBeNull();
    expect(validateVendor(null)).toBeNull();
    expect(validateVendor('vendor')).toBeNull();
  });

  it('rejects inverted price ranges and absurd numbers', () => {
    expect(validateVendor({ ...valid, priceMinINR: 90_000, priceMaxINR: 10_000 })).toBeNull();
    expect(validateVendor({ ...valid, rating: 42 })).toMatchObject({ rating: null });
  });

  it('only trusts https links', () => {
    expect(validateVendor({ ...valid, sourceUrl: 'http://insecure.example' })).toMatchObject({
      sourceUrl: null,
    });
    expect(validateVendor({ ...valid, sourceUrl: 'javascript:alert(1)' })).toMatchObject({
      sourceUrl: null,
    });
  });

  it('defaults unproven records to sample status', () => {
    const vendor = validateVendor({ ...valid, isSample: undefined });
    expect(vendor!.isSample).toBe(true);
    expect(vendor!.verification).toBe('sample-demo');
  });

  it('rejects oversized junk fields', () => {
    expect(validateVendor({ ...valid, name: 'x'.repeat(200) })).toBeNull();
    expect(validateVendor({ ...valid, description: 'x'.repeat(1000) })).toBeNull();
  });
});

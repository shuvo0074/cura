/** Fares and test prices. Samples are always labelled, never shown as real. */
interface VendorRow {
  id?: unknown;
  slug: string;
  hidden?: unknown;
  categories: string[];
  fares?: Record<string, { min: number; max: number }> | null;
  [key: string]: unknown;
}

export type SampleFares = Record<string, { min: number; max: number }>;

/** Public vendor: `id` is the slug, each offered type gets a quoted or sample fare. */
export function withFares(vendor: VendorRow, sampleFares: SampleFares | null) {
  const { fares: quoted, slug, id: _id, hidden: _hidden, ...rest } = vendor;
  const fares: Record<string, { min: number; max: number; kind: 'quoted' | 'sample' }> = {};
  for (const category of vendor.categories) {
    if (quoted?.[category]) fares[category] = { ...quoted[category], kind: 'quoted' };
    else if (sampleFares?.[category]) fares[category] = { ...sampleFares[category], kind: 'sample' };
  }
  return { ...rest, id: slug, fares };
}

export interface TestPrice {
  name: string;
  category?: string;
  price?: number | null;
  [key: string]: unknown;
}

/**
 * Fills unknown diagnostic prices from the sample list, adding price_kind: 'demo'.
 * `sample` is null when admins have switched samples off.
 */
export function withSampleTestPrices<T extends { type?: unknown; tests?: unknown }>(
  hospital: T,
  sample: TestPrice[] | null,
): T {
  if (hospital.type !== 'diagnostic' || !sample) return hospital;
  const byName = new Map(sample.map((test) => [test.name, test]));
  const existing = Array.isArray(hospital.tests) ? (hospital.tests as TestPrice[]) : [];
  const base: TestPrice[] = existing.length ? existing : sample.map((test) => ({ ...test, price: null }));
  const tests = base.map((test) => {
    const match = byName.get(test.name);
    if ((test.price !== null && test.price !== undefined) || !match) return test;
    const { source_url: _url, source_checked_on: _date, source_test_name: _name, ...details } = test;
    return { ...details, price: match.price, price_kind: 'demo' };
  });
  return { ...hospital, tests };
}

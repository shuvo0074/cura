import { readFileSync } from 'node:fs';

const published = JSON.parse(readFileSync(new URL('./data/publishedTestPrices.json', import.meta.url), 'utf8'));
// Seed for the sample price list admins edit (site_settings.sample_test_prices).
export const SEED_SAMPLE_TEST_PRICES = JSON.parse(readFileSync(new URL('./data/demoTestPrices.json', import.meta.url), 'utf8'));

// Centre names that have published rates in server/data/publishedTestPrices.json.
export const PUBLISHED_CENTRES = Object.keys(published);

// Fill missing diagnostic prices from the published rates, keeping where each
// came from. Admin-entered rates take priority. Used once to import the rates
// into the database (db/contentSeeds.js); after that admins edit them there.
export function withPublishedTestPrices(hospital) {
  const rates = hospital.type === 'diagnostic' ? published[hospital.name] : null;
  if (!rates) return hospital;
  const tests = [...(hospital.tests || [])];
  for (const { match_name, ...rate } of rates) {
    const index = tests.findIndex(test => test.name === match_name || test.name === rate.name);
    if (index < 0) tests.push(rate);
    else if (tests[index].price == null) tests[index] = { ...tests[index], ...rate };
  }
  return { ...hospital, tests };
}

// Sample amounts are explicitly marked and only fill unknown rates for common
// diagnostic tests. They never replace published or admin-entered rates.
// `sample` is the admin-edited list, or null when sample prices are switched off.
export function withSampleTestPrices(hospital, sample) {
  if (hospital.type !== 'diagnostic' || !sample) return hospital;
  const byName = new Map(sample.map(test => [test.name, test]));
  const tests = (hospital.tests?.length ? hospital.tests : sample.map(test => ({ ...test, price: null })))
    .map(test => {
      const match = byName.get(test.name);
      if (test.price != null || !match) return test;
      const { source_url: _source, source_checked_on: _date, source_test_name: _sourceName, ...details } = test;
      return { ...details, price: match.price, price_kind: 'demo' };
    });
  return { ...hospital, tests };
}

// Published rates, then the seed sample list: what the API showed before the
// rates moved into the database.
export function withDiagnosticTestPrices(hospital, sample = SEED_SAMPLE_TEST_PRICES) {
  return withSampleTestPrices(withPublishedTestPrices(hospital), sample);
}

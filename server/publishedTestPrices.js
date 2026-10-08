import { readFileSync } from 'node:fs';

const published = JSON.parse(readFileSync(new URL('./data/publishedTestPrices.json', import.meta.url), 'utf8'));
const demo = JSON.parse(readFileSync(new URL('./data/demoTestPrices.json', import.meta.url), 'utf8'));

// Fill missing diagnostic prices at read time so existing installations gain
// published rates without a database backfill. Admin-entered rates take priority.
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

// Sample amounts are explicitly identified and only fill unknown rates for
// common diagnostic tests. They never replace published or admin-entered rates.
export function withDiagnosticTestPrices(hospital) {
  const result = withPublishedTestPrices(hospital);
  if (result.type !== 'diagnostic') return result;
  const byName = new Map(demo.map(test => [test.name, test]));
  const tests = (result.tests?.length ? result.tests : demo.map(test => ({ ...test, price: null })))
    .map(test => {
      const sample = byName.get(test.name);
      if (test.price != null || !sample) return test;
      const { source_url: _source, source_checked_on: _date, source_test_name: _sourceName, ...details } = test;
      return { ...details, price: sample.price, price_kind: 'demo' };
    });
  return { ...result, tests };
}

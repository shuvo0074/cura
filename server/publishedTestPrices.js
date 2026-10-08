import { readFileSync } from 'node:fs';

const published = JSON.parse(readFileSync(new URL('./data/publishedTestPrices.json', import.meta.url), 'utf8'));

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

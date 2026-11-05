/**
 * Imports the directory's real, sourced records and reference data.
 *
 *   npm run seed:directory
 *
 * Each import runs once, recorded under an `import:*` key, so re-running never
 * overwrites what admins have edited or deleted. Doctors are not imported: every
 * doctor signs up or is added by an admin, so each one has a real phone number.
 */
import { Prisma, PrismaClient } from '@prisma/client';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const prisma = new PrismaClient();
type Tx = Prisma.TransactionClient;
type Row = Record<string, any>;

const read = <T = any>(name: string): T =>
  JSON.parse(readFileSync(join(__dirname, 'directory-data', `${name}.json`), 'utf8')) as T;

const VERIFIED_ON = new Date('2026-10-09T00:00:00Z');
const unsplash = (id?: string) => (id ? `https://images.unsplash.com/photo-${id}?w=400&h=220&fit=crop` : null);

const COMMON_TESTS: [string, string][] = [
  ['Complete Blood Count (CBC)', 'blood'],
  ['Random Blood Sugar (RBS)', 'blood'],
  ['HbA1c', 'blood'],
  ['Lipid Profile', 'blood'],
  ['Thyroid (TSH)', 'blood'],
  ['Serum Creatinine', 'blood'],
  ['Urine Routine Examination', 'blood'],
  ['Dengue NS1 Antigen', 'blood'],
  ['X-ray Chest (PA view)', 'imaging'],
  ['Ultrasound Whole Abdomen', 'imaging'],
  ['CT Scan Brain', 'imaging'],
  ['MRI Brain', 'imaging'],
  ['ECG', 'cardiac'],
  ['Echocardiogram', 'cardiac'],
];

/** The common test list with each centre's published prices merged in. */
function centreTests(centreName: string, published: Record<string, Row[]>): Row[] {
  const tests: Row[] = COMMON_TESTS.map(([name, category]) => ({ name, category, price: null }));
  for (const { match_name, ...rate } of published[centreName] ?? []) {
    const index = tests.findIndex((test) => test.name === match_name || test.name === rate.name);
    if (index < 0) tests.push(rate);
    else if (tests[index]!.price === null) tests[index] = { ...tests[index], ...rate };
  }
  return tests;
}

async function once(tx: Tx, key: string, run: () => Promise<void>): Promise<void> {
  const { count } = await tx.siteSetting.createMany({
    data: [{ key: `import:${key}`, value: true }],
    skipDuplicates: true,
  });
  if (count) {
    await run();
    console.log(`Imported ${key}`);
  }
}

async function setDefault(tx: Tx, key: string, value: Prisma.InputJsonValue): Promise<void> {
  await tx.siteSetting.createMany({ data: [{ key, value }], skipDuplicates: true });
}

async function seed(tx: Tx): Promise<void> {
  // Serialises concurrent runs so an import cannot happen twice.
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext('cura:directory-seed'))::text`;

  await setDefault(tx, 'ambulance_sample_fares', read('ambulanceSampleFares').categories);
  await setDefault(tx, 'sample_test_prices', read('demoTestPrices'));
  await setDefault(tx, 'show_sample_test_prices', true);
  await setDefault(tx, 'home_content', read('homeContent'));
  await setDefault(tx, 'photo_credits', read('photoCredits'));
  await setDefault(tx, 'contact_numbers', { emergency: '999', health_line: '16263', hotline: '16966' });
  await setDefault(tx, 'site_text', { en: {}, bn: {} });

  await once(tx, 'specialties', async () => {
    const details = read<Row>('specialtyDetails');
    await tx.specialty.createMany({
      data: read<Row[]>('specialties').map((s) => ({
        slug: s.slug,
        name: s.name,
        icon: s.icon,
        description: details[s.name]?.description ?? null,
        tags: details[s.name]?.tags ?? [],
        image: unsplash(details[s.name]?.image),
      })),
      skipDuplicates: true,
    });
  });

  await once(tx, 'symptoms', async () => {
    const details = read<Row>('symptomDetails');
    await tx.symptom.createMany({
      data: read<Row[]>('symptoms').map((s) => ({
        slug: s.slug,
        name: s.name,
        description: details[s.name]?.description ?? null,
        tags: details[s.name]?.tags ?? [],
        image: unsplash(details[s.name]?.image),
      })),
      skipDuplicates: true,
    });
  });

  await once(tx, 'ambulance_vendors', async () => {
    await tx.ambulanceVendor.createMany({
      data: read<Row[]>('ambulanceVendors').map((v) => ({
        slug: v.id,
        name: v.name,
        nameBn: v.name_bn,
        baseArea: v.base_area,
        address: v.address,
        addressBn: v.address_bn,
        phones: v.phones,
        categories: v.categories,
        features: v.features,
        dhakaWide: v.dhaka_wide,
        serviceAreas: v.service_areas,
        sourceUrl: v.source_url,
        sourceCheckedOn: v.source_checked_on ? new Date(`${v.source_checked_on}T00:00:00Z`) : null,
      })),
      skipDuplicates: true,
    });
  });

  await once(tx, 'diagnostic_centres', async () => {
    const published = read<Record<string, Row[]>>('publishedTestPrices');
    for (const c of read<Row[]>('diagnosticCentres')) {
      await tx.hospital.create({
        data: {
          name: c.name,
          location: c.location,
          division: c.division,
          address: c.address,
          hotline: c.hotline,
          website: c.website,
          description: c.description,
          type: 'diagnostic',
          services: c.homeSample ? [{ key: 'home_sample', hours: null }] : [],
          tests: centreTests(c.name, published) as Prisma.InputJsonValue,
          openingHours: c.openingHours ?? null,
          sourceUrl: c.sourceUrl,
          verifiedOn: VERIFIED_ON,
          photo: c.photo ?? null,
        },
      });
    }
  });
}

prisma
  .$transaction(seed, { timeout: 60_000 })
  .then(() => console.log('Directory seed complete.'))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

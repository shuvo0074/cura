// Demo data: adds services, beds, test prices, facilities, payment methods
// and hours to src/data/hospitals.json, shaped by what kind of place each one
// is (medical college hospital, diagnostic centre, small clinic, online).
// Deterministic per hospital id, so re-running it doesn't reshuffle anything.
// Real values replace these at launch.
//
//   node scripts/build-hospital-extras.mjs

import { readFileSync, writeFileSync } from 'fs';

const FILE = new URL('../src/data/hospitals.json', import.meta.url);

// Small seeded PRNG (mulberry32) so each hospital gets stable "random" values.
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function typeOf(name) {
  if (/telemedicine/i.test(name)) return 'online';
  if (/diagnostic centre$/i.test(name)) return 'diagnostic';
  // "Medical Centre" in Bangladesh is usually a full hospital; these are outpatient-only.
  if (/clinic|chamber|health centre|health point|child care|skin care/i.test(name) && !/hospital/i.test(name)) return 'clinic';
  return 'hospital';
}

// Larger institutions: medical colleges and well-known specialised names.
function isMajor(name) {
  return /medical college|evercare|square|apollo|labaid|ibn sina|specialized|national/i.test(name);
}

const OPEN_24 = '24/7';
const DAY = '8:00 AM – 10:00 PM';
const LAB = '7:00 AM – 9:00 PM';

const TESTS = [
  // [name, category, [min, max] BDT]
  ['Complete Blood Count (CBC)', 'blood', [350, 600]],
  ['Random Blood Sugar (RBS)', 'blood', [120, 250]],
  ['HbA1c', 'blood', [900, 1500]],
  ['Lipid Profile', 'blood', [900, 1600]],
  ['Thyroid (TSH)', 'blood', [700, 1200]],
  ['Serum Creatinine', 'blood', [350, 600]],
  ['Urine Routine Examination', 'blood', [200, 400]],
  ['Dengue NS1 Antigen', 'blood', [300, 500]],
  ['X-ray Chest (PA view)', 'imaging', [400, 800]],
  ['Ultrasound Whole Abdomen', 'imaging', [1500, 3000]],
  ['CT Scan Brain', 'imaging', [3500, 6000]],
  ['MRI Brain', 'imaging', [7500, 14000]],
  ['ECG', 'cardiac', [250, 600]],
  ['Echocardiogram', 'cardiac', [2000, 4000]],
];

function price(r, [min, max], tier) {
  // Major hospitals price near the top of the range, clinics near the bottom.
  const base = min + (max - min) * (tier * 0.6 + r() * 0.4);
  return Math.round(base / 50) * 50;
}

function pick(r, list, n) {
  return [...list].sort(() => r() - 0.5).slice(0, n);
}

function extrasFor(h) {
  const r = rng(Number(h.id) * 7919);
  const type = typeOf(h.name);
  const major = isMajor(h.name);

  if (type === 'online') {
    return {
      type, services: [], beds: null, tests: [], facilities: [], paymentMethods: ['bkash', 'nagad', 'card'],
      openingHours: '8:00 AM – 11:00 PM', visitingHours: null,
    };
  }

  const services = [];
  const add = (key, hours) => services.push({ key, hours });
  let tests = TESTS.filter(([, cat]) => cat !== 'imaging' || type !== 'clinic');
  let beds = null;

  if (type === 'hospital') {
    add('emergency', OPEN_24);
    add('ambulance', OPEN_24);
    add('pharmacy', OPEN_24);
    add('lab', OPEN_24);
    add('xray', OPEN_24);
    add('ultrasound', DAY);
    add('ecg_echo', DAY);
    add('operation_theatre', OPEN_24);
    add('icu', OPEN_24);
    if (major || r() > 0.4) add('ccu', OPEN_24);
    if (major || r() > 0.5) add('nicu', OPEN_24);
    add('maternity', OPEN_24);
    if (major || r() > 0.5) add('ct_scan', OPEN_24);
    if (major) add('mri', DAY);
    if (major || r() > 0.6) add('blood_bank', OPEN_24);
    if (major || r() > 0.6) add('dialysis', '8:00 AM – 8:00 PM');
    add('physiotherapy', '9:00 AM – 5:00 PM');
    add('vaccination', '9:00 AM – 3:00 PM');
    if (/diagnostic/i.test(h.name)) add('home_sample', '7:00 AM – 7:00 PM');
    const scale = major ? 2.5 : 1;
    beds = {
      general: Math.round((40 + r() * 80) * scale / 10) * 10,
      cabin: Math.round((10 + r() * 30) * scale / 5) * 5,
      icu: Math.round((4 + r() * 8) * scale),
    };
    if (!services.some(s => s.key === 'mri')) tests = tests.filter(([name]) => !name.startsWith('MRI'));
    if (!services.some(s => s.key === 'ct_scan')) tests = tests.filter(([name]) => !name.startsWith('CT'));
  } else if (type === 'diagnostic') {
    add('lab', LAB);
    add('home_sample', '7:00 AM – 7:00 PM');
    add('xray', LAB);
    add('ultrasound', LAB);
    add('ecg_echo', LAB);
    add('ct_scan', LAB);
    add('mri', LAB);
    add('pharmacy', DAY);
  } else {
    add('pharmacy', DAY);
    add('lab', '8:00 AM – 8:00 PM');
    if (r() > 0.5) add('ecg_echo', '9:00 AM – 9:00 PM');
    if (r() > 0.6) add('vaccination', '9:00 AM – 3:00 PM');
    tests = tests.filter(([, cat]) => cat !== 'imaging').slice(0, 8);
    tests = tests.filter(([name]) => name !== 'Echocardiogram' || services.some(s => s.key === 'ecg_echo'));
  }

  const tier = type === 'clinic' ? 0.1 : major ? 0.9 : 0.5;
  const facilities = [
    'waiting_area', 'wheelchair',
    ...pick(r, ['parking', 'prayer_room', 'cafeteria', 'atm', 'lift', 'female_staff'], type === 'hospital' ? 5 : 3),
  ];
  const paymentMethods = ['cash', 'bkash', ...(r() > 0.3 ? ['nagad'] : []), ...(type !== 'clinic' || r() > 0.5 ? ['card'] : []), ...(major && type === 'hospital' ? ['insurance'] : [])];

  return {
    type,
    services,
    beds,
    tests: tests.map(([name, category, range]) => ({ name, category, price: price(r, range, tier) })),
    facilities,
    paymentMethods,
    openingHours: type === 'hospital' ? OPEN_24 : type === 'diagnostic' ? 'Sat – Thu, 7:00 AM – 9:00 PM · Fri, 3:00 PM – 9:00 PM' : 'Sat – Thu, 9:00 AM – 10:00 PM',
    visitingHours: type === 'hospital' ? '11:00 AM – 1:00 PM, 5:00 PM – 7:00 PM' : null,
  };
}

const hospitals = JSON.parse(readFileSync(FILE, 'utf8'));
const next = hospitals.map(h => ({ ...h, ...extrasFor(h) }));
writeFileSync(FILE, JSON.stringify(next, null, 2) + '\n');

const byType = next.reduce((m, h) => ({ ...m, [h.type]: (m[h.type] || 0) + 1 }), {});
console.log(`Updated ${next.length} hospitals:`, byType);

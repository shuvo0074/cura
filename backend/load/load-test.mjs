// Load test: 100 concurrent connections per scenario against the Cura API,
// plus a "mixed100" run — 100 users looping through a realistic working mix.
//
// usage (from backend/):  npm run load -- [baseUrl] [seconds]
//   ONLY=calendarWeek,mixed100 npm run load        # run selected scenarios
//
// Start the API with THROTTLE_DISABLED=true first: from one machine every
// request shares an IP, so the per-IP rate limits would otherwise answer 429.
// For realistic numbers, load bulk-data.sql into a copy of the database.
import autocannon from 'autocannon';

const base = process.argv[2] ?? 'http://localhost:3000/api';
const duration = Number(process.argv[3] ?? 10);
const P = '11111111-1111-4111-8111-111111111111';

// Fresh token per scenario: a long run outlives the 15-minute access token.
const freshAuth = async () => {
  const login = await fetch(`${base}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ identifier: 'admin@cura.local', password: 'CuraAdmin123' }),
  }).then((r) => r.json());
  return { authorization: `Bearer ${login.session.accessToken}` };
};
let auth = await freshAuth();

const patients = await fetch(`${base}/patients?practiceId=${P}`, { headers: auth }).then((r) => r.json());
const patientId = (patients.items ?? patients.data ?? patients)[0].id;

const today = new Date(); today.setHours(0, 0, 0, 0);
const weekEnd = new Date(today.getTime() + 7 * 86_400_000);
const iso = (d) => d.toISOString();
const day = today.toISOString().slice(0, 10);

const scenarios = {
  calendarWeek: `/appointments?practiceId=${P}&from=${iso(today)}&to=${iso(weekEnd)}`,
  queueSummary: `/appointments/queue-summary?practiceId=${P}&date=${day}`,
  patientSearch: `/patients/search?practiceId=${P}&q=rah`,
  patientList: `/patients?practiceId=${P}`,
  timeline: `/clinical/patients/${patientId}/timeline?practiceId=${P}`,
  upcoming: `/engagement/upcoming?practiceId=${P}&days=30`,
  dailyCounts: `/appointments/daily-counts?practiceId=${P}&from=${iso(new Date(today.getFullYear(), today.getMonth(), 1))}&to=${iso(new Date(today.getFullYear(), today.getMonth() + 1, 1))}&timeZone=Asia/Dhaka`,
  monthList: `/appointments?practiceId=${P}&from=${iso(new Date(today.getFullYear(), today.getMonth(), 1))}&to=${iso(new Date(today.getFullYear(), today.getMonth() + 1, 1))}`,
  profile: `/account/profile`,
  practice: `/settings/practice?practiceId=${P}`,
};

const only = process.env.ONLY?.split(',');
const rows = [];
for (const [name, path] of Object.entries(scenarios)) {
  if (only && !only.includes(name)) continue;
  auth = await freshAuth();
  const r = await autocannon({ url: base + path, connections: 100, duration, headers: auth });
  rows.push({
    scenario: name,
    'req/s': Math.round(r.requests.average),
    p50: r.latency.p50,
    p97_5: r.latency.p97_5,
    p99: r.latency.p99,
    non2xx: r.non2xx,
    errors: r.errors + r.timeouts,
  });
}

// 100 concurrent users, each looping through a realistic working mix.
if (!only || only.includes('mixed100')) {
  auth = await freshAuth();
  const mix = ['calendarWeek', 'queueSummary', 'patientSearch', 'timeline', 'calendarWeek', 'dailyCounts', 'patientList', 'upcoming', 'practice', 'profile'];
  const r = await autocannon({
    url: base,
    connections: 100,
    duration: duration * 2,
    headers: auth,
    requests: mix.map((k) => ({ method: 'GET', path: '/api' + scenarios[k] })),
  });
  rows.push({ scenario: 'mixed100', 'req/s': Math.round(r.requests.average), p50: r.latency.p50, p97_5: r.latency.p97_5, p99: r.latency.p99, non2xx: r.non2xx, errors: r.errors + r.timeouts });
}

if (!only || only.includes('login')) {
  const r = await autocannon({
    url: `${base}/auth/login`,
    method: 'POST',
    connections: 100,
    duration,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ identifier: 'doctor@cura.local', password: 'CuraDoctor123' }),
  });
  rows.push({ scenario: 'login', 'req/s': Math.round(r.requests.average), p50: r.latency.p50, p97_5: r.latency.p97_5, p99: r.latency.p99, non2xx: r.non2xx, errors: r.errors + r.timeouts });
}
console.table(rows);

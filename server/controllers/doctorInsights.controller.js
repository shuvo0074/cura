import { query } from '../db.js';

const DAYS = 30;
const TODAY = `(now() AT TIME ZONE 'Asia/Dhaka')::date`;

// Adds one to today's counter (views or shares) for a doctor.
export function bumpDailyStat(doctorId, column) {
  return query(
    `INSERT INTO doctor_daily_stats (doctor_id, day, ${column}) VALUES ($1, ${TODAY}, 1)
     ON CONFLICT (doctor_id, day) DO UPDATE SET ${column} = doctor_daily_stats.${column} + 1`,
    [doctorId]
  );
}

// A patient opened the public profile. The doctor looking at their own page
// doesn't count; the browser sends this once per doctor per day.
export async function recordView(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (req.user?.doctorId === id) return res.status(204).end();
    const { rows } = await query('SELECT 1 FROM doctors WHERE id = $1', [id]);
    if (!rows[0]) return res.status(404).json({ error: 'Doctor not found' });
    await bumpDailyStat(id, 'views');
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

// The signed-in doctor's reach over the last 30 days against the 30 before:
// profile views, call taps and shares, plus a day-by-day series for views.
export async function myInsights(req, res, next) {
  try {
    const id = req.user.doctorId;
    const [series, totals, calls, peers, reviews] = await Promise.all([
      query(
        `SELECT to_char(d.day, 'YYYY-MM-DD') AS day, COALESCE(s.views, 0) AS views,
                COALESCE(c.calls, 0) AS calls
           FROM generate_series(${TODAY} - ${DAYS - 1}, ${TODAY}, interval '1 day') AS d(day)
           LEFT JOIN doctor_daily_stats s ON s.doctor_id = $1 AND s.day = d.day
           LEFT JOIN (
             SELECT (created_at AT TIME ZONE 'Asia/Dhaka')::date AS day, COUNT(*)::int AS calls
               FROM call_logs WHERE doctor_id = $1 AND created_at > now() - interval '${DAYS + 1} days'
              GROUP BY 1
           ) c ON c.day = d.day
          ORDER BY d.day`,
        [id]
      ),
      query(
        `SELECT COALESCE(SUM(views) FILTER (WHERE day > ${TODAY} - ${DAYS}), 0)::int AS views,
                COALESCE(SUM(views) FILTER (WHERE day <= ${TODAY} - ${DAYS}), 0)::int AS views_prev,
                COALESCE(SUM(shares) FILTER (WHERE day > ${TODAY} - ${DAYS}), 0)::int AS shares,
                COALESCE(SUM(shares) FILTER (WHERE day <= ${TODAY} - ${DAYS}), 0)::int AS shares_prev
           FROM doctor_daily_stats WHERE doctor_id = $1 AND day > ${TODAY} - ${DAYS * 2}`,
        [id]
      ),
      query(
        `SELECT COUNT(*) FILTER (WHERE created_at > now() - interval '${DAYS} days')::int AS calls,
                COUNT(*) FILTER (WHERE created_at <= now() - interval '${DAYS} days')::int AS calls_prev
           FROM call_logs WHERE doctor_id = $1 AND created_at > now() - interval '${DAYS * 2} days'`,
        [id]
      ),
      query(
        `SELECT COUNT(*)::int AS recognitions, COUNT(DISTINCT endorser_doctor_id)::int AS peers
           FROM doctor_endorsements WHERE doctor_id = $1`,
        [id]
      ),
      query(
        `SELECT COUNT(*)::int AS count, ROUND(AVG(rating)::numeric, 1)::float AS average
           FROM doctor_reviews WHERE doctor_id = $1 AND hidden_at IS NULL`,
        [id]
      ),
    ]);
    res.json({
      days: DAYS,
      series: series.rows,
      ...totals.rows[0],
      ...calls.rows[0],
      ...peers.rows[0],
      reviews: reviews.rows[0],
    });
  } catch (err) {
    next(err);
  }
}

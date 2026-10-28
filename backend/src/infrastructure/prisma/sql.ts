import { Prisma } from '@prisma/client';

/**
 * An instant as a UTC `timestamp`, for raw SQL.
 *
 * Prisma stores DateTime as `timestamp(3)` holding UTC wall time, but a Date
 * bound into `$queryRaw` arrives as `timestamptz`, and Postgres converts it to
 * `timestamp` in the *session* time zone when the two are compared. On a
 * server set to Asia/Dhaka that shifts every bound by six hours — windows open
 * and close at the wrong instant, silently. Casting explicitly through UTC
 * makes the comparison independent of the server's TimeZone setting.
 */
export const utc = (instant: Date): Prisma.Sql =>
  Prisma.sql`(${instant.toISOString()}::timestamptz AT TIME ZONE 'UTC')`;

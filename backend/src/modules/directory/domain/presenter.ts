/**
 * Turns a stored row into the JSON the directory frontend reads.
 *
 * That contract is snake_case with date-only strings and lower-case enum values.
 * Rows come from explicit select lists, so nothing unlisted can leak through here;
 * JSON columns keep their inner keys untouched.
 */
const DATE_ONLY = new Set(['verifiedOn', 'sourceCheckedOn', 'day']);
const LOWERCASE = new Set(['status', 'kind']);

const snake = (key: string): string => key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);

export function present<T extends object>(row: T): Record<string, any> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (DATE_ONLY.has(key) && value instanceof Date) out[snake(key)] = value.toISOString().slice(0, 10);
    else if (LOWERCASE.has(key) && typeof value === 'string') out[snake(key)] = value.toLowerCase();
    else out[snake(key)] = value;
  }
  return out;
}

/** A serial booking in the shape the frontend knows as an appointment. */
export function presentBooking<T extends { bookingDate: Date; startTime: string }>(row: T): Record<string, any> {
  const { bookingDate, startTime, ...rest } = row;
  return {
    ...present(rest),
    appointment_date: bookingDate.toISOString().slice(0, 10),
    appointment_time: `${startTime}:00`,
  };
}

interface DegreeItem {
  title: string;
  endYear: number | null;
  createdAt: Date;
}

/** Qualifications in the order earned, else the listing's education text. */
function degreeLine(items: DegreeItem[], education: string | null): string | null {
  if (!items.length) return education;
  return [...items]
    .sort((a, b) => {
      if (a.endYear !== b.endYear) {
        if (a.endYear === null) return 1;
        if (b.endYear === null) return -1;
        return a.endYear - b.endYear;
      }
      return a.createdAt.getTime() - b.createdAt.getTime();
    })
    .map((item) => item.title)
    .join(', ');
}

/** A listing row with its computed fields. Never carries the owner's user id. */
export function presentListing(row: Record<string, any>): Record<string, any> {
  const { userId, user, hospital, items, ...rest } = row;
  const out = present(rest);
  // A doctor who proved their phone runs this profile; one an admin added does not yet.
  if ('user' in row) out.is_managed = Boolean(user?.mobileVerifiedAt);
  if ('hospital' in row) out.hospital_name = hospital?.name ?? null;
  if ('items' in row) out.degrees = degreeLine(items as DegreeItem[], rest.education ?? null);
  return out;
}

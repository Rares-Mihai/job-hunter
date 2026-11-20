// Date helpers. Deadlines are calendar days ("YYYY-MM-DD") with no time zone,
// so all the arithmetic here is done on UTC midnights.

const DAY_MS = 24 * 60 * 60 * 1000;

const DAY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Parses "YYYY-MM-DD" into a UTC midnight, or null if it is not a real date. */
export function parseDay(value: string): Date | null {
  const match = DAY_PATTERN.exec(value);
  if (!match) return null;
  const [, y, m, d] = match;
  const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
  // Reject things like 2026-02-31, which Date would roll over into March.
  if (
    date.getUTCFullYear() !== Number(y) ||
    date.getUTCMonth() !== Number(m) - 1 ||
    date.getUTCDate() !== Number(d)
  ) {
    return null;
  }
  return date;
}

export function toDayString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function utcMidnight(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

/** Whole days from `now` until the deadline. Negative when it has passed. */
export function daysUntil(deadline: string, now: Date): number | null {
  const day = parseDay(deadline);
  if (!day) return null;
  return Math.round((day.getTime() - utcMidnight(now)) / DAY_MS);
}

/** Whole calendar days (UTC) from `date` until `now`. */
export function daysSince(date: Date, now: Date): number {
  return Math.round((utcMidnight(now) - utcMidnight(date)) / DAY_MS);
}

export type DeadlineTone= "late" | "soon" | "later";

export type DeadlineInfo = { label: string; tone: DeadlineTone };

const SHORT_DATE = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

const LONG_DATE = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

export function formatDay(date: Date): string {
  return LONG_DATE.format(date);
}

/** Wording and urgency for a deadline, as shown on a board card. */
export function describeDeadline(
  deadline: string,
  now: Date,
): DeadlineInfo | null {
  const days = daysUntil(deadline, now);
  const day = parseDay(deadline);
  if (days === null || !day) return null;

  if (days < -1) return { label: `${-days} days overdue`, tone: "late" };
  if (days === -1) return { label: "1 day overdue", tone: "late" };
  if (days === 0) return { label: "Due today", tone: "soon" };
  if (days === 1) return { label: "Due tomorrow", tone: "soon" };
  if (days <= 7) return { label: `Due in ${days} days`, tone: "soon" };
  return { label: `Due ${SHORT_DATE.format(day)}`, tone: "later" };
}

/** The Monday (UTC) of the week that contains `date`. */
export function startOfWeek(date: Date): Date {
  const midnight = utcMidnight(date);
  const weekday = new Date(midnight).getUTCDay(); // 0 = Sunday
  const daysSinceMonday = (weekday + 6) % 7;
  return new Date(midnight - daysSinceMonday * DAY_MS);
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

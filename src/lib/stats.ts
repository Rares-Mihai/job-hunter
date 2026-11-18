import { addDays, startOfWeek, toDayString } from "./dates";
import { isSent, STATUSES, type Status } from "./status";

// Pure functions that turn applications and their stage history into the
// numbers on the Stats page. No database access here, so it is easy to test.

export type StatsApplication = {
  id: string;
  status: Status;
  createdAt: Date;
};

export type StatsChange = {
  applicationId: string;
  toStatus: Status;
  changedAt: Date;
};

export type WeekCount = {
  /** Monday of the week, "YYYY-MM-DD". */
  weekStart: string;
  count: number;
};

export type Stats = {
  total: number;
  byStatus: Record<Status, number>;
  /** Applications that have left the wishlist. */
  sent: number;
  /** Sent applications that got any answer: an interview, an offer or a rejection. */
  heardBack: number;
  /** Sent applications that reached an interview or an offer at some point. */
  reachedInterview: number;
  /** Applications sent per week, oldest first. */
  weekly: WeekCount[];
};

const WEEKS_SHOWN = 8;

export function computeStats(
  applications: StatsApplication[],
  changes: StatsChange[],
  now: Date,
): Stats {
  const byStatus = Object.fromEntries(
    STATUSES.map((status) => [status, 0]),
  ) as Record<Status, number>;

  const changesByApplication = new Map<string, StatsChange[]>();
  for (const change of changes) {
    const list = changesByApplication.get(change.applicationId) ?? [];
    list.push(change);
    changesByApplication.set(change.applicationId, list);
  }

  const thisWeek = startOfWeek(now);
  const weekly: WeekCount[] = [];
  const weekIndex = new Map<string, number>();
  for (let i = WEEKS_SHOWN - 1; i >= 0; i--) {
    const weekStart = toDayString(addDays(thisWeek, -7 * i));
    weekIndex.set(weekStart, weekly.length);
    weekly.push({ weekStart, count: 0 });
  }

  let sent = 0;
  let heardBack = 0;
  let reachedInterview = 0;

  for (const application of applications) {
    byStatus[application.status] += 1;
    if (!isSent(application.status)) continue;

    sent += 1;
    const history = changesByApplication.get(application.id) ?? [];

    if (application.status !== "applied") heardBack += 1;

    const everInterviewed =
      application.status === "interview" ||
      application.status === "offer" ||
      history.some(
        (change) =>
          change.toStatus === "interview" || change.toStatus === "offer",
      );
    if (everInterviewed) reachedInterview += 1;

    // The day it was sent is the first time it left the wishlist. Fall back
    // to the creation date for applications with no recorded history.
    const sentAt = history
      .filter((change) => isSent(change.toStatus))
      .reduce<Date | null>(
        (earliest, change) =>
          earliest === null || change.changedAt < earliest
            ? change.changedAt
            : earliest,
        null,
      );
    const week = toDayString(startOfWeek(sentAt ?? application.createdAt));
    const index = weekIndex.get(week);
    if (index !== undefined) weekly[index].count += 1;
  }

  return {
    total: applications.length,
    byStatus,
    sent,
    heardBack,
    reachedInterview,
    weekly,
  };
}

/** "3 of 12" style share as a whole percentage, or null when there is nothing to divide by. */
export function percent(part: number, whole: number): number | null {
  if (whole <= 0) return null;
  return Math.round((part / whole) * 100);
}

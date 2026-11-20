import { daysSince } from "./dates";
import type { Status } from "./status";

export const FOLLOW_UP_AFTER_DAYS = 10;

type Change = { toStatus: Status; changedAt: Date };

/** When the application most recently moved into Applied, if ever. */
export function lastAppliedAt(changes: Change[]): Date | null {
  let latest: Date | null = null;
  for (const change of changes) {
    if (change.toStatus !== "applied") continue;
    if (!latest || change.changedAt > latest) latest = change.changedAt;
  }
  return latest;
}

/** The "follow up?" nudge for a card, or null when there is nothing to say. */
export function followUpNudge(
  status: Status,
  changes: Change[],
  now: Date,
  fallback?: Date,
): string | null {
  if (status !== "applied") return null;
  const since = lastAppliedAt(changes) ?? fallback;
  if (!since) return null;
  const days = daysSince(since, now);
  if (days < FOLLOW_UP_AFTER_DAYS) return null;
  return `No reply in ${days} days — follow up?`;
}

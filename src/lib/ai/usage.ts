import { eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { aiUsage } from "@/db/schema";

// Every AI request costs money on the app owner's API key, and anyone with a
// GitHub account can sign in. Two daily limits keep the bill bounded: one per
// user, and one for all users together.

const DEFAULT_PER_USER = 20;
const DEFAULT_TOTAL = 200;

/** Reads a positive whole number from the environment, or uses the fallback. */
export function readLimit(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function getAiLimits(): { perUser: number; total: number } {
  return {
    perUser: readLimit(process.env.AI_DAILY_LIMIT_PER_USER, DEFAULT_PER_USER),
    total: readLimit(process.env.AI_DAILY_LIMIT_TOTAL, DEFAULT_TOTAL),
  };
}

export type Reservation = "ok" | "user-limit" | "total-limit";

/** Today's date in UTC, the day the counters are kept for. */
const TODAY = sql`(now() at time zone 'utc')::date`;

/**
 * Counts one AI request for this user today, unless a limit is reached.
 * Call it right before talking to the API: a request that then fails still
 * counts, which keeps a broken setup from being retried without end.
 */
export async function reserveAiRequest(userId: string): Promise<Reservation> {
  const limits = getAiLimits();
  const db = getDb();

  const [{ total }] = await db
    .select({ total: sql<number>`coalesce(sum(${aiUsage.count}), 0)::int` })
    .from(aiUsage)
    .where(eq(aiUsage.day, TODAY));
  if (total >= limits.total) return "total-limit";

  // One statement, so two requests at the same moment cannot both slip past
  // the per-user limit: the update only happens while the count is below it.
  const updated = await db
    .insert(aiUsage)
    .values({ userId, day: TODAY, count: 1 })
    .onConflictDoUpdate({
      target: [aiUsage.userId, aiUsage.day],
      set: { count: sql`${aiUsage.count} + 1` },
      setWhere: sql`${aiUsage.count} < ${limits.perUser}`,
    })
    .returning({ count: aiUsage.count });

  return updated.length > 0 ? "ok" : "user-limit";
}

export function describeLimit(reservation: Exclude<Reservation, "ok">): string {
  return reservation === "user-limit"
    ? "You have used today's AI requests. The limit resets at midnight UTC."
    : "The app has reached today's limit for AI requests. Try again tomorrow.";
}

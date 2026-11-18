import { timingSafeEqual } from "node:crypto";
import { and, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { applications, reminderSettings, users } from "@/db/schema";
import { addDays, daysUntil, toDayString } from "./dates";

// Email reminders: once a day, everyone who switched them on gets one email
// listing the wishlist jobs whose deadline is at most three days away.
// Sending goes through Resend (https://resend.com); nothing is sent unless
// RESEND_API_KEY and REMINDER_FROM_EMAIL are set.

export const REMIND_DAYS_AHEAD = 3;

export function areRemindersConfigured(): boolean {
  return Boolean(
    process.env.RESEND_API_KEY &&
    process.env.REMINDER_FROM_EMAIL &&
    process.env.CRON_SECRET,
  );
}

/** Checks the secret the daily trigger sends, without leaking it through timing. */
export function isCronAuthorized(header: string | null): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || !header) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(header);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export async function getRemindersEnabled(userId: string): Promise<boolean> {
  const rows = await getDb()
    .select({ enabled: reminderSettings.enabled })
    .from(reminderSettings)
    .where(eq(reminderSettings.userId, userId))
    .limit(1);
  return rows[0]?.enabled ?? false;
}

export async function setRemindersEnabled(
  userId: string,
  enabled: boolean,
): Promise<void> {
  await getDb()
    .insert(reminderSettings)
    .values({ userId, enabled })
    .onConflictDoUpdate({ target: reminderSettings.userId, set: { enabled } });
}

export type ReminderItem = { company: string; role: string; deadline: string };

export type Email = { to: string; subject: string; text: string };

function dueWording(deadline: string, now: Date): string {
  const days = daysUntil(deadline, now);
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  return `in ${days} days`;
}

/** The email for one person. Plain text, so nothing in it can be mistaken for markup. */
export function buildReminderEmail(
  to: string,
  name: string,
  items: ReminderItem[],
  now: Date,
  appUrl: string,
): Email {
  const lines = items.map(
    (item) =>
      `- ${item.company}, ${item.role}: apply by ${item.deadline} (${dueWording(item.deadline, now)})`,
  );
  const subject =
    items.length === 1
      ? `Deadline ${dueWording(items[0].deadline, now)}: ${items[0].company}`
      : `${items.length} application deadlines coming up`;
  return {
    to,
    subject,
    text: [
      `Hi ${name},`,
      "",
      items.length === 1
        ? "One job on your wishlist closes soon:"
        : "These jobs on your wishlist close soon:",
      "",
      ...lines,
      "",
      `Your board: ${appUrl}`,
      "",
      "You get this because deadline reminders are switched on in Job Hunter.",
      `Switch them off on your account page: ${appUrl}/account`,
    ].join("\n"),
  };
}

/** Sends one email through Resend. Throws if Resend does not accept it. */
export async function sendWithResend(email: Email): Promise<void> {
  const base = process.env.RESEND_BASE_URL ?? "https://api.resend.com";
  const response = await fetch(`${base}/emails`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.REMINDER_FROM_EMAIL,
      to: [email.to],
      subject: email.subject,
      text: email.text,
    }),
  });
  if (!response.ok) {
    throw new Error(`Resend answered ${response.status}`);
  }
}

/**
 * Sends today's reminders. Each deadline is marked once its email went out,
 * so running this twice in a day (or a retry after a failure) does not send
 * the same reminder again.
 */
export async function sendDueReminders(
  now: Date,
  send: (email: Email) => Promise<void> = sendWithResend,
): Promise<{ sent: number; failed: number }> {
  const db = getDb();
  const today = toDayString(now);
  const last = toDayString(addDays(now, REMIND_DAYS_AHEAD));

  const rows = await db
    .select({
      id: applications.id,
      company: applications.company,
      role: applications.role,
      deadline: applications.deadline,
      userId: users.id,
      name: users.name,
      email: users.email,
    })
    .from(applications)
    .innerJoin(users, eq(applications.userId, users.id))
    .innerJoin(reminderSettings, eq(reminderSettings.userId, users.id))
    .where(
      and(
        eq(reminderSettings.enabled, true),
        eq(applications.status, "wishlist"),
        isNotNull(applications.deadline),
        sql`${applications.deadline} between ${today} and ${last}`,
        sql`${applications.remindedDeadline} is distinct from ${applications.deadline}`,
      ),
    )
    .orderBy(applications.deadline);

  const perUser = new Map<string, typeof rows>();
  for (const row of rows) {
    perUser.set(row.userId, [...(perUser.get(row.userId) ?? []), row]);
  }

  const appUrl = (process.env.BETTER_AUTH_URL ?? "").replace(/\/$/, "");
  let sent = 0;
  let failed = 0;
  for (const items of perUser.values()) {
    const email = buildReminderEmail(
      items[0].email,
      items[0].name,
      items.map((item) => ({
        company: item.company,
        role: item.role,
        deadline: item.deadline as string,
      })),
      now,
      appUrl,
    );
    try {
      await send(email);
      await db
        .update(applications)
        .set({ remindedDeadline: sql`${applications.deadline}` })
        .where(
          inArray(
            applications.id,
            items.map((item) => item.id),
          ),
        );
      sent += 1;
    } catch {
      // Leave these unmarked; tomorrow's run (or a retry) picks them up.
      failed += 1;
    }
  }
  return { sent, failed };
}

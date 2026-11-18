import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getDb } from "@/db";
import { aiUsage, users } from "@/db/schema";
import { reserveAiRequest } from "./ai/usage";
import {
  createApplication,
  deleteApplication,
  getApplication,
  getCv,
  listAllStatusChanges,
  listApplications,
  listStatusHistory,
  moveApplication,
  saveAnalysis,
  saveCv,
  saveMatch,
  updateApplication,
} from "./applications";
import { addDays, toDayString } from "./dates";
import { sendDueReminders, setRemindersEnabled, type Email } from "./reminders";
import type { ApplicationInput } from "./validation";

// These tests run against a real Postgres database and check the property
// that matters most once there are accounts: one user can never read or
// change another user's data. They are skipped unless TEST_DATABASE_URL is
// set (CI sets it; see .github/workflows/ci.yml).

const url = process.env.TEST_DATABASE_URL;

const ANA = `test-ana-${process.pid}`;
const BOGDAN = `test-bogdan-${process.pid}`;

const INPUT: ApplicationInput = {
  company: "Endava",
  role: "Junior Developer",
  url: null,
  location: null,
  status: "wishlist",
  deadline: null,
  notes: "private note",
  jobDescription: "Python and SQL.",
};

const MATCH = {
  score: 50,
  verdict: "v",
  matchedSkills: [],
  missingSkills: [],
  highlights: [],
  suggestions: [],
};

describe.skipIf(!url)("data ownership", () => {
  let anasApplication: string;

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    for (const id of [ANA, BOGDAN]) {
      await getDb()
        .insert(users)
        .values({ id, name: id, email: `${id}@example.com` });
    }
    anasApplication = await createApplication(ANA, INPUT);
  });

  afterAll(async () => {
    // Deleting the users removes everything they own (cascade).
    for (const id of [ANA, BOGDAN]) {
      await getDb().delete(users).where(eq(users.id, id));
    }
  });

  it("lets the owner read their application and its history", async () => {
    expect((await getApplication(ANA, anasApplication))?.company).toBe(
      "Endava",
    );
    expect(await listApplications(ANA)).toHaveLength(1);
    expect(await listStatusHistory(ANA, anasApplication)).toHaveLength(1);
    expect(await listAllStatusChanges(ANA)).toHaveLength(1);
  });

  it("hides it from another user", async () => {
    expect(await getApplication(BOGDAN, anasApplication)).toBeNull();
    expect(await listApplications(BOGDAN)).toEqual([]);
    expect(await listStatusHistory(BOGDAN, anasApplication)).toEqual([]);
    expect(await listAllStatusChanges(BOGDAN)).toEqual([]);
  });

  it("refuses changes from another user", async () => {
    expect(
      await updateApplication(BOGDAN, anasApplication, {
        ...INPUT,
        company: "Hacked",
      }),
    ).toBe(false);
    expect(await moveApplication(BOGDAN, anasApplication, "rejected")).toBe(
      false,
    );
    await saveAnalysis(BOGDAN, anasApplication, {
      summary: "hacked",
      seniority: "junior",
      requirements: [],
      responsibilities: [],
    });
    await saveMatch(BOGDAN, anasApplication, MATCH);
    await deleteApplication(BOGDAN, anasApplication);

    const untouched = await getApplication(ANA, anasApplication);
    expect(untouched).toMatchObject({
      company: "Endava",
      status: "wishlist",
      analysis: null,
      match: null,
    });
    expect(await listStatusHistory(ANA, anasApplication)).toHaveLength(1);
  });

  it("keeps each user's CV separate", async () => {
    await saveMatch(ANA, anasApplication, MATCH);
    await saveCv(BOGDAN, { text: "Bogdan's CV", fileName: "bogdan.pdf" });

    expect(await getCv(ANA)).toEqual({ text: "", fileName: null });
    expect(await getCv(BOGDAN)).toEqual({
      text: "Bogdan's CV",
      fileName: "bogdan.pdf",
    });
    // Bogdan changing his CV must not clear Ana's match score.
    expect((await getApplication(ANA, anasApplication))?.match?.score).toBe(50);

    // Ana changing hers does clear it.
    await saveCv(ANA, { text: "Ana's CV", fileName: null });
    expect((await getApplication(ANA, anasApplication))?.match).toBeNull();
  });

  it("records a stage change made by the owner", async () => {
    expect(await moveApplication(ANA, anasApplication, "applied")).toBe(true);
    const history = await listStatusHistory(ANA, anasApplication);
    expect(history.map((change) => change.toStatus)).toEqual([
      "wishlist",
      "applied",
    ]);
  });

  it("stops AI requests at the per-user daily limit", async () => {
    process.env.AI_DAILY_LIMIT_PER_USER = "3";
    process.env.AI_DAILY_LIMIT_TOTAL = "1000000";
    const results = [];
    for (let i = 0; i < 5; i++) results.push(await reserveAiRequest(ANA));
    expect(results).toEqual(["ok", "ok", "ok", "user-limit", "user-limit"]);
    // Another user still has their own allowance.
    expect(await reserveAiRequest(BOGDAN)).toBe("ok");

    const [row] = await getDb()
      .select({ count: aiUsage.count })
      .from(aiUsage)
      .where(eq(aiUsage.userId, ANA));
    expect(row.count).toBe(3);
  });

  it("does not let simultaneous requests slip past the limit", async () => {
    process.env.AI_DAILY_LIMIT_PER_USER = "5";
    const results = await Promise.all(
      Array.from({ length: 12 }, () => reserveAiRequest(BOGDAN)),
    );
    // Bogdan already used 1 above, so only 4 more may pass.
    expect(results.filter((r) => r === "ok")).toHaveLength(4);
  });

  it("stops everyone at the total daily limit", async () => {
    process.env.AI_DAILY_LIMIT_PER_USER = "1000000";
    process.env.AI_DAILY_LIMIT_TOTAL = "1";
    expect(await reserveAiRequest(ANA)).toBe("total-limit");
  });

  it("emails deadline reminders once, only to people who asked", async () => {
    const now = new Date();
    const soon = toDayString(addDays(now, 2));
    const far = toDayString(addDays(now, 20));
    const base = { ...INPUT, status: "wishlist" as const };
    await createApplication(ANA, {
      ...base,
      company: "Soon Co",
      deadline: soon,
    });
    await createApplication(ANA, { ...base, company: "Far Co", deadline: far });
    await createApplication(ANA, {
      ...base,
      company: "Already Sent Co",
      status: "applied",
      deadline: soon,
    });
    await createApplication(BOGDAN, {
      ...base,
      company: "Bogdan Co",
      deadline: soon,
    });
    await setRemindersEnabled(ANA, true); // Bogdan never switched them on

    const outbox: Email[] = [];
    const send = async (email: Email) => void outbox.push(email);

    expect(await sendDueReminders(now, send)).toEqual({ sent: 1, failed: 0 });
    expect(outbox).toHaveLength(1);
    expect(outbox[0].to).toBe(`${ANA}@example.com`);
    expect(outbox[0].text).toContain("Soon Co");
    expect(outbox[0].text).not.toContain("Far Co");
    expect(outbox[0].text).not.toContain("Already Sent Co");
    expect(outbox[0].text).not.toContain("Bogdan Co");

    // A second run the same day sends nothing new.
    expect(await sendDueReminders(now, send)).toEqual({ sent: 0, failed: 0 });
    expect(outbox).toHaveLength(1);
  });

  it("tries again later when sending fails", async () => {
    const now = new Date();
    await createApplication(BOGDAN, {
      ...INPUT,
      company: "Retry Co",
      deadline: toDayString(addDays(now, 1)),
    });
    await setRemindersEnabled(BOGDAN, true);
    await setRemindersEnabled(ANA, false);

    const failing = async () => {
      throw new Error("mail server down");
    };
    expect(await sendDueReminders(now, failing)).toEqual({
      sent: 0,
      failed: 1,
    });

    const outbox: Email[] = [];
    expect(
      await sendDueReminders(now, async (email) => void outbox.push(email)),
    ).toEqual({ sent: 1, failed: 0 });
    expect(outbox[0].text).toContain("Retry Co");
  });

  it("removes a user's data when the user is deleted", async () => {
    await getDb().delete(users).where(eq(users.id, ANA));
    expect(await listApplications(ANA)).toEqual([]);
    expect(await getCv(ANA)).toEqual({ text: "", fileName: null });
  });
});

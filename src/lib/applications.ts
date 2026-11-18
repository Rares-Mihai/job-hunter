import { and, asc, desc, eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import {
  applications,
  cvs,
  goals,
  statusChanges,
  users,
  type Application,
  type StatusChange,
} from "@/db/schema";
import type { CvMatch, InterviewPrep, JobAnalysis } from "./ai/schemas";
import type { Status } from "./status";
import { isUuid, type ApplicationInput } from "./validation";

// All database reads and writes for applications and CVs live in this file.
//
// Every function takes the id of the signed-in user first and only ever
// touches that user's rows. Nothing outside this file queries these tables,
// so this is the one place to check that users cannot see each other's data.

/** Everything the AI produced from the posting and the CV, cleared when either changes. */
const STALE_AI_RESULTS = {
  analysis: null,
  match: null,
  coverLetter: null,
  interviewPrep: null,
};

/** Matches one application, but only if it belongs to this user. */
function ownedBy(userId: string, id: string) {
  return and(eq(applications.id, id), eq(applications.userId, userId));
}

export async function listApplications(userId: string): Promise<Application[]> {
  return getDb()
    .select()
    .from(applications)
    .where(eq(applications.userId, userId))
    .orderBy(
      // Soonest deadline first; applications without one go last.
      sql`${applications.deadline} asc nulls last`,
      desc(applications.updatedAt),
    );
}

export async function getApplication(
  userId: string,
  id: string,
): Promise<Application | null> {
  if (!isUuid(id)) return null;
  const rows = await getDb()
    .select()
    .from(applications)
    .where(ownedBy(userId, id))
    .limit(1);
  return rows[0] ?? null;
}

export async function listStatusHistory(
  userId: string,
  id: string,
): Promise<StatusChange[]> {
  if (!isUuid(id)) return [];
  const rows = await getDb()
    .select({ change: statusChanges })
    .from(statusChanges)
    .innerJoin(applications, eq(statusChanges.applicationId, applications.id))
    .where(ownedBy(userId, id))
    .orderBy(asc(statusChanges.changedAt));
  return rows.map((row) => row.change);
}

export async function listAllStatusChanges(
  userId: string,
): Promise<StatusChange[]> {
  const rows = await getDb()
    .select({ change: statusChanges })
    .from(statusChanges)
    .innerJoin(applications, eq(statusChanges.applicationId, applications.id))
    .where(eq(applications.userId, userId));
  return rows.map((row) => row.change);
}

export async function createApplication(
  userId: string,
  input: ApplicationInput,
): Promise<string> {
  return getDb().transaction(async (tx) => {
    const [row] = await tx
      .insert(applications)
      .values({ ...input, userId })
      .returning({ id: applications.id });
    await tx.insert(statusChanges).values({
      applicationId: row.id,
      fromStatus: null,
      toStatus: input.status,
    });
    return row.id;
  });
}

/** Returns false when the user has no such application. */
export async function updateApplication(
  userId: string,
  id: string,
  input: ApplicationInput,
): Promise<boolean> {
  if (!isUuid(id)) return false;
  return getDb().transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(applications)
      .where(ownedBy(userId, id))
      .for("update");
    if (!current) return false;

    // The AI results describe the posting text. If the text changed, they no
    // longer describe this job, so drop them instead of showing stale advice.
    const postingChanged = current.jobDescription !== input.jobDescription;

    await tx
      .update(applications)
      .set({
        ...input,
        ...(postingChanged ? STALE_AI_RESULTS : {}),
        updatedAt: new Date(),
      })
      .where(ownedBy(userId, id));

    if (current.status !== input.status) {
      await tx.insert(statusChanges).values({
        applicationId: id,
        fromStatus: current.status,
        toStatus: input.status,
      });
    }
    return true;
  });
}

/** Moves an application to another stage. Returns false if the user has no such application. */
export async function moveApplication(
  userId: string,
  id: string,
  status: Status,
): Promise<boolean> {
  if (!isUuid(id)) return false;
  return getDb().transaction(async (tx) => {
    const [current] = await tx
      .select({ status: applications.status })
      .from(applications)
      .where(ownedBy(userId, id))
      .for("update");
    if (!current) return false;
    if (current.status === status) return true;

    await tx
      .update(applications)
      .set({ status, updatedAt: new Date() })
      .where(ownedBy(userId, id));
    await tx.insert(statusChanges).values({
      applicationId: id,
      fromStatus: current.status,
      toStatus: status,
    });
    return true;
  });
}

export async function deleteApplication(
  userId: string,
  id: string,
): Promise<void> {
  if (!isUuid(id)) return;
  await getDb().delete(applications).where(ownedBy(userId, id));
}

export async function saveAnalysis(
  userId: string,
  id: string,
  analysis: JobAnalysis,
): Promise<void> {
  if (!isUuid(id)) return;
  // A new analysis changes the list of requirements, so an older CV match
  // (which was scored against the previous list) is cleared with it.
  await getDb()
    .update(applications)
    .set({ analysis, match: null, updatedAt: new Date() })
    .where(ownedBy(userId, id));
}

export async function saveMatch(
  userId: string,
  id: string,
  match: CvMatch,
): Promise<void> {
  if (!isUuid(id)) return;
  await getDb()
    .update(applications)
    .set({ match, updatedAt: new Date() })
    .where(ownedBy(userId, id));
}

export async function saveCoverLetter(
  userId: string,
  id: string,
  coverLetter: string,
): Promise<void> {
  if (!isUuid(id)) return;
  await getDb()
    .update(applications)
    .set({ coverLetter, updatedAt: new Date() })
    .where(ownedBy(userId, id));
}

export async function saveInterviewPrep(
  userId: string,
  id: string,
  interviewPrep: InterviewPrep,
): Promise<void> {
  if (!isUuid(id)) return;
  await getDb()
    .update(applications)
    .set({ interviewPrep, updatedAt: new Date() })
    .where(ownedBy(userId, id));
}

/** Removes the account and, through the database's cascade rules, everything it owns. */
export async function deleteUserAndData(userId: string): Promise<void> {
  await getDb().delete(users).where(eq(users.id, userId));
}

export type SavedCv = {
  text: string;
  /** Name of the uploaded PDF the text was read from, if any. */
  fileName: string | null;
};

const NO_CV: SavedCv = { text: "", fileName: null };

export async function getCv(userId: string): Promise<SavedCv> {
  const rows = await getDb()
    .select({ text: cvs.text, fileName: cvs.fileName })
    .from(cvs)
    .where(eq(cvs.userId, userId))
    .limit(1);
  return rows[0] ?? NO_CV;
}

export async function saveCv(userId: string, cv: SavedCv): Promise<void> {
  await getDb().transaction(async (tx) => {
    const [current] = await tx
      .select({ text: cvs.text })
      .from(cvs)
      .where(eq(cvs.userId, userId))
      .for("update");

    await tx
      .insert(cvs)
      .values({ userId, text: cv.text, fileName: cv.fileName })
      .onConflictDoUpdate({
        target: cvs.userId,
        set: { text: cv.text, fileName: cv.fileName, updatedAt: new Date() },
      });

    // Match scores, cover letters and interview prep were based on the
    // previous CV text. (The posting analysis does not use the CV.)
    if ((current?.text ?? "") !== cv.text) {
      await tx
        .update(applications)
        .set({ match: null, coverLetter: null, interviewPrep: null })
        .where(eq(applications.userId, userId));
    }
  });
}

export const DEFAULT_WEEKLY_TARGET = 5;
export const MAX_WEEKLY_TARGET = 50;

export async function getWeeklyTarget(userId: string): Promise<number> {
  const rows = await getDb()
    .select({ weeklyTarget: goals.weeklyTarget })
    .from(goals)
    .where(eq(goals.userId, userId))
    .limit(1);
  return rows[0]?.weeklyTarget ?? DEFAULT_WEEKLY_TARGET;
}

export async function saveWeeklyTarget(
  userId: string,
  weeklyTarget: number,
): Promise<void> {
  await getDb()
    .insert(goals)
    .values({ userId, weeklyTarget })
    .onConflictDoUpdate({ target: goals.userId, set: { weeklyTarget } });
}

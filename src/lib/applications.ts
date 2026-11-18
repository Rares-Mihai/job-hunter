import { asc, desc, eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import {
  applications,
  profile,
  statusChanges,
  type Application,
  type StatusChange,
} from "@/db/schema";
import type { CvMatch, JobAnalysis } from "./ai/schemas";
import type { Status } from "./status";
import { isUuid, type ApplicationInput } from "./validation";

// All database reads and writes for the app live in this file. When user
// accounts are added, this is the one place that needs to filter by owner.

export async function listApplications(): Promise<Application[]> {
  return getDb()
    .select()
    .from(applications)
    .orderBy(
      // Soonest deadline first; applications without one go last.
      sql`${applications.deadline} asc nulls last`,
      desc(applications.updatedAt),
    );
}

export async function getApplication(id: string): Promise<Application | null> {
  if (!isUuid(id)) return null;
  const rows = await getDb()
    .select()
    .from(applications)
    .where(eq(applications.id, id))
    .limit(1);
  return rows[0] ?? null;
}

export async function listStatusHistory(id: string): Promise<StatusChange[]> {
  if (!isUuid(id)) return [];
  return getDb()
    .select()
    .from(statusChanges)
    .where(eq(statusChanges.applicationId, id))
    .orderBy(asc(statusChanges.changedAt));
}

export async function listAllStatusChanges(): Promise<StatusChange[]> {
  return getDb().select().from(statusChanges);
}

export async function createApplication(
  input: ApplicationInput,
): Promise<string> {
  return getDb().transaction(async (tx) => {
    const [row] = await tx
      .insert(applications)
      .values(input)
      .returning({ id: applications.id });
    await tx.insert(statusChanges).values({
      applicationId: row.id,
      fromStatus: null,
      toStatus: input.status,
    });
    return row.id;
  });
}

/** Returns false when the application does not exist. */
export async function updateApplication(
  id: string,
  input: ApplicationInput,
): Promise<boolean> {
  if (!isUuid(id)) return false;
  return getDb().transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(applications)
      .where(eq(applications.id, id))
      .for("update");
    if (!current) return false;

    // The AI results describe the posting text. If the text changed, they no
    // longer describe this job, so drop them instead of showing stale advice.
    const postingChanged = current.jobDescription !== input.jobDescription;

    await tx
      .update(applications)
      .set({
        ...input,
        ...(postingChanged ? { analysis: null, match: null } : {}),
        updatedAt: new Date(),
      })
      .where(eq(applications.id, id));

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

/** Moves an application to another stage. Returns false if it does not exist. */
export async function moveApplication(
  id: string,
  status: Status,
): Promise<boolean> {
  if (!isUuid(id)) return false;
  return getDb().transaction(async (tx) => {
    const [current] = await tx
      .select({ status: applications.status })
      .from(applications)
      .where(eq(applications.id, id))
      .for("update");
    if (!current) return false;
    if (current.status === status) return true;

    await tx
      .update(applications)
      .set({ status, updatedAt: new Date() })
      .where(eq(applications.id, id));
    await tx.insert(statusChanges).values({
      applicationId: id,
      fromStatus: current.status,
      toStatus: status,
    });
    return true;
  });
}

export async function deleteApplication(id: string): Promise<void> {
  if (!isUuid(id)) return;
  await getDb().delete(applications).where(eq(applications.id, id));
}

export async function saveAnalysis(
  id: string,
  analysis: JobAnalysis,
): Promise<void> {
  // A new analysis changes the list of requirements, so an older CV match
  // (which was scored against the previous list) is cleared with it.
  await getDb()
    .update(applications)
    .set({ analysis, match: null, updatedAt: new Date() })
    .where(eq(applications.id, id));
}

export async function saveMatch(id: string, match: CvMatch): Promise<void> {
  await getDb()
    .update(applications)
    .set({ match, updatedAt: new Date() })
    .where(eq(applications.id, id));
}

const PROFILE_ID = 1;

export async function getCv(): Promise<string> {
  const rows = await getDb()
    .select({ cvText: profile.cvText })
    .from(profile)
    .where(eq(profile.id, PROFILE_ID))
    .limit(1);
  return rows[0]?.cvText ?? "";
}

export async function saveCv(cvText: string): Promise<void> {
  await getDb().transaction(async (tx) => {
    const [current] = await tx
      .select({ cvText: profile.cvText })
      .from(profile)
      .where(eq(profile.id, PROFILE_ID))
      .for("update");
    if (current?.cvText === cvText) return;

    await tx
      .insert(profile)
      .values({ id: PROFILE_ID, cvText })
      .onConflictDoUpdate({
        target: profile.id,
        set: { cvText, updatedAt: new Date() },
      });
    // Earlier match scores were based on the previous CV.
    await tx.update(applications).set({ match: null });
  });
}

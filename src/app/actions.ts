"use server";

import { refresh } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AiError, analyzeJob, isAiConfigured, matchCv } from "@/lib/ai/client";
import { describeLimit, reserveAiRequest } from "@/lib/ai/usage";
import {
  createApplication,
  deleteApplication,
  getApplication,
  getCv,
  MAX_WEEKLY_TARGET,
  saveWeeklyTarget,
  moveApplication,
  saveAnalysis,
  saveCv,
  saveMatch,
  updateApplication,
} from "@/lib/applications";
import { getAuth, isSignInConfigured } from "@/lib/auth";
import { cleanFileName, MAX_CV_PDF_BYTES, readCvPdf } from "@/lib/cv-pdf";
import { importPosting } from "@/lib/posting-import";
import { requireUser } from "@/lib/session";
import { isStatus } from "@/lib/status";
import {
  MAX_CV_CHARS,
  normalizeNewlines,
  parseApplicationForm,
  type FieldErrors,
} from "@/lib/validation";

// Everything the browser can ask the server to change. These are reachable by
// direct POST, not only through the UI, so each one starts by finding out who
// is signed in (visitors who are not get sent to the sign-in page) and checks
// its own input. The data functions then only touch that user's rows.

export type FormState = {
  ok: boolean;
  message?: string;
  errors?: FieldErrors;
  /**
   * What the user typed, sent back when validation fails. React resets a
   * form after its action runs, and this lets the form keep the input.
   */
  values?: Record<string, string>;
};

function submittedValues(formData: FormData): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [name, value] of formData.entries()) {
    // Names starting with "$" are React's own bookkeeping fields.
    if (typeof value === "string" && !name.startsWith("$")) {
      values[name] = value;
    }
  }
  return values;
}

export type ActionResult = { ok: true } | { ok: false; message: string };

export async function createApplicationAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = parseApplicationForm(formData);
  if (!parsed.ok) {
    return {
      ok: false,
      errors: parsed.errors,
      values: submittedValues(formData),
    };
  }

  const user = await requireUser();
  const id = await createApplication(user.id, parsed.data);
  redirect(`/applications/${id}`);
}

export async function updateApplicationAction(
  id: string,
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = parseApplicationForm(formData);
  if (!parsed.ok) {
    return {
      ok: false,
      errors: parsed.errors,
      values: submittedValues(formData),
    };
  }

  const user = await requireUser();
  const found = await updateApplication(user.id, id, parsed.data);
  if (!found) {
    return { ok: false, message: "This application no longer exists." };
  }
  refresh();
  return { ok: true, message: "Saved" };
}

export async function moveApplicationAction(
  id: string,
  status: string,
): Promise<ActionResult> {
  if (!isStatus(status)) return { ok: false, message: "Unknown stage." };
  const user = await requireUser();
  const found = await moveApplication(user.id, id, status);
  refresh();
  return found
    ? { ok: true }
    : { ok: false, message: "This application no longer exists." };
}

export async function deleteApplicationAction(id: string): Promise<void> {
  const user = await requireUser();
  await deleteApplication(user.id, id);
  redirect("/");
}

export async function saveCvAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const value = formData.get("cvText");
  const cvText =
    typeof value === "string" ? normalizeNewlines(value).trim() : "";
  if (cvText.length > MAX_CV_CHARS) {
    return {
      ok: false,
      message: "The CV is too long. Keep it under 30,000 characters.",
      values: { cvText },
    };
  }
  // Keep the PDF's name next to the text unless the text was cleared.
  const current = await getCv(user.id);
  await saveCv(user.id, {
    text: cvText,
    fileName: cvText === "" ? null : current.fileName,
  });
  refresh();
  return { ok: true, message: "Saved" };
}

export async function uploadCvAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const file = formData.get("cvFile");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: "Choose a PDF file first." };
  }
  if (file.size > MAX_CV_PDF_BYTES) {
    return {
      ok: false,
      message: "That file is too large. Upload a PDF under 4 MB.",
    };
  }

  const result = await readCvPdf(new Uint8Array(await file.arrayBuffer()));
  if (!result.ok) return { ok: false, message: result.message };

  await saveCv(user.id, {
    text: result.text,
    fileName: cleanFileName(file.name),
  });
  refresh();
  return {
    ok: true,
    message: result.truncated
      ? "Uploaded. The CV is long, so only the first 30,000 characters are used."
      : "Uploaded",
  };
}

/** Checks the daily limits and counts this request against them. */
async function reserveAi(userId: string): Promise<ActionResult> {
  if (!isAiConfigured()) {
    return {
      ok: false,
      message:
        "AI is not set up yet. Add ANTHROPIC_API_KEY to the .env file and restart the app.",
    };
  }
  const reservation = await reserveAiRequest(userId);
  return reservation === "ok"
    ? { ok: true }
    : { ok: false, message: describeLimit(reservation) };
}

export async function analyzeJobAction(id: string): Promise<ActionResult> {
  const user = await requireUser();
  const application = await getApplication(user.id, id);
  if (!application) {
    return { ok: false, message: "This application no longer exists." };
  }
  if (application.jobDescription.trim() === "") {
    return {
      ok: false,
      message: "Paste the job posting and save it first.",
    };
  }

  const reserved = await reserveAi(user.id);
  if (!reserved.ok) return reserved;

  try {
    const analysis = await analyzeJob(application.jobDescription);
    await saveAnalysis(user.id, id, analysis);
  } catch (error) {
    if (error instanceof AiError) return { ok: false, message: error.message };
    throw error;
  }
  refresh();
  return { ok: true };
}

export async function matchCvAction(id: string): Promise<ActionResult> {
  const user = await requireUser();
  const application = await getApplication(user.id, id);
  if (!application) {
    return { ok: false, message: "This application no longer exists." };
  }
  if (application.jobDescription.trim() === "") {
    return {
      ok: false,
      message: "Paste the job posting and save it first.",
    };
  }
  const cv = await getCv(user.id);
  if (cv.text.trim() === "") {
    return { ok: false, message: "Add your CV on the CV page first." };
  }

  const reserved = await reserveAi(user.id);
  if (!reserved.ok) return reserved;

  try {
    const match = await matchCv({
      cv: cv.text,
      jobDescription: application.jobDescription,
      analysis: application.analysis,
    });
    await saveMatch(user.id, id, match);
  } catch (error) {
    if (error instanceof AiError) return { ok: false, message: error.message };
    throw error;
  }
  refresh();
  return { ok: true };
}

export async function signInWithGitHubAction(): Promise<void> {
  if (!isSignInConfigured()) redirect("/sign-in");
  const result = await getAuth().api.signInSocial({
    body: {
      provider: "github",
      callbackURL: "/",
      errorCallbackURL: "/sign-in?error=1",
    },
  });
  if (!result.url) redirect("/sign-in?error=1");
  redirect(result.url);
}

export async function signOutAction(): Promise<void> {
  if (isSignInConfigured()) {
    await getAuth().api.signOut({ headers: await headers() });
  }
  redirect("/sign-in");
}

export async function saveWeeklyTargetAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const target = Number(formData.get("weeklyTarget"));
  if (!Number.isInteger(target) || target < 1 || target > MAX_WEEKLY_TARGET) {
    return {
      ok: false,
      message: `Enter a whole number from 1 to ${MAX_WEEKLY_TARGET}.`,
    };
  }
  await saveWeeklyTarget(user.id, target);
  refresh();
  return { ok: true, message: "Saved" };
}

/**
 * Downloads a job page and returns what was found on it, to fill in the
 * "Add application" form. Nothing is saved until the user submits that form.
 */
export async function importPostingAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireUser();
  const link = formData.get("link");
  const result = await importPosting(typeof link === "string" ? link : "");
  if (!result.ok) return { ok: false, message: result.message };
  return {
    ok: true,
    message: "Imported. Check the fields below, then add the application.",
    values: { ...result.posting, url: String(link).trim() },
  };
}

"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { AiError, analyzeJob, matchCv } from "@/lib/ai/client";
import {
  createApplication,
  deleteApplication,
  getApplication,
  getCv,
  moveApplication,
  saveAnalysis,
  saveCv,
  saveMatch,
  updateApplication,
} from "@/lib/applications";
import { isStatus } from "@/lib/status";
import {
  MAX_CV_CHARS,
  parseApplicationForm,
  type FieldErrors,
} from "@/lib/validation";

// Everything the browser can ask the server to change. Each function checks
// its own input: these are reachable by direct POST, not only through the UI.

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

  const id = await createApplication(parsed.data);
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

  const found = await updateApplication(id, parsed.data);
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
  const found = await moveApplication(id, status);
  refresh();
  return found
    ? { ok: true }
    : { ok: false, message: "This application no longer exists." };
}

export async function deleteApplicationAction(id: string): Promise<void> {
  await deleteApplication(id);
  redirect("/");
}

export async function saveCvAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const value = formData.get("cvText");
  const cvText = typeof value === "string" ? value.trim() : "";
  if (cvText.length > MAX_CV_CHARS) {
    return {
      ok: false,
      message: "The CV is too long. Keep it under 30,000 characters.",
      values: { cvText },
    };
  }
  await saveCv(cvText);
  refresh();
  return { ok: true, message: "Saved" };
}

export async function analyzeJobAction(id: string): Promise<ActionResult> {
  const application = await getApplication(id);
  if (!application) {
    return { ok: false, message: "This application no longer exists." };
  }
  if (application.jobDescription.trim() === "") {
    return {
      ok: false,
      message: "Paste the job posting and save it first.",
    };
  }

  try {
    const analysis = await analyzeJob(application.jobDescription);
    await saveAnalysis(id, analysis);
  } catch (error) {
    if (error instanceof AiError) return { ok: false, message: error.message };
    throw error;
  }
  refresh();
  return { ok: true };
}

export async function matchCvAction(id: string): Promise<ActionResult> {
  const application = await getApplication(id);
  if (!application) {
    return { ok: false, message: "This application no longer exists." };
  }
  if (application.jobDescription.trim() === "") {
    return {
      ok: false,
      message: "Paste the job posting and save it first.",
    };
  }
  const cv = await getCv();
  if (cv.trim() === "") {
    return { ok: false, message: "Add your CV on the CV page first." };
  }

  try {
    const match = await matchCv({
      cv,
      jobDescription: application.jobDescription,
      analysis: application.analysis,
    });
    await saveMatch(id, match);
  } catch (error) {
    if (error instanceof AiError) return { ok: false, message: error.message };
    throw error;
  }
  refresh();
  return { ok: true };
}

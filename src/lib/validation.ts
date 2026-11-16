import { z } from "zod";
import { parseDay } from "./dates";
import { STATUSES } from "./status";

export const MAX_JOB_DESCRIPTION_CHARS = 30_000;
export const MAX_CV_CHARS = 30_000;

/** Browsers submit line breaks in a textarea as CRLF; store plain LF. */
export function normalizeNewlines(value: string): string {
  return value.replace(/\r\n?/g, "\n");
}

const optionalText = (max: number, tooLong: string) =>
  z
    .string()
    .trim()
    .max(max, tooLong)
    .transform((value) => (value === "" ? null : value));

/**
 * Only http and https links are accepted. The link is later rendered as a
 * clickable <a href>, so schemes like `javascript:` must never be stored.
 */
const optionalHttpUrl = z
  .string()
  .trim()
  .max(2000, "That link is too long.")
  .transform((value, ctx) => {
    if (value === "") return null;
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      ctx.addIssue({
        code: "custom",
        message: "Enter a full link, starting with https://",
      });
      return z.NEVER;
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      ctx.addIssue({
        code: "custom",
        message: "The link must start with http:// or https://",
      });
      return z.NEVER;
    }
    return url.toString();
  });

const optionalDay = z
  .string()
  .trim()
  .transform((value, ctx) => {
    if (value === "") return null;
    if (!parseDay(value)) {
      ctx.addIssue({ code: "custom", message: "Enter a valid date." });
      return z.NEVER;
    }
    return value;
  });

export const applicationInputSchema = z.object({
  company: z
    .string()
    .trim()
    .min(1, "Enter the company name.")
    .max(120, "Keep the company name under 120 characters."),
  role: z
    .string()
    .trim()
    .min(1, "Enter the role you are applying for.")
    .max(160, "Keep the role under 160 characters."),
  url: optionalHttpUrl,
  location: optionalText(120, "Keep the location under 120 characters."),
  status: z.enum(STATUSES, "Choose a stage."),
  deadline: optionalDay,
  notes: z
    .string()
    .transform(normalizeNewlines)
    .pipe(z.string().max(10_000, "Keep notes under 10,000 characters.")),
  jobDescription: z
    .string()
    .transform(normalizeNewlines)
    .pipe(
      z
        .string()
        .max(
          MAX_JOB_DESCRIPTION_CHARS,
          "The job posting is too long. Paste only the description, up to 30,000 characters.",
        ),
    ),
});

export type ApplicationInput = z.infer<typeof applicationInputSchema>;

export type FieldErrors = Partial<Record<keyof ApplicationInput, string>>;

export type ParsedApplication =
  { ok: true; data: ApplicationInput } | { ok: false; errors: FieldErrors };

/** Validates the add/edit form. Missing fields are treated as empty. */
export function parseApplicationForm(formData: FormData): ParsedApplication {
  const text = (name: string) => {
    const value = formData.get(name);
    return typeof value === "string" ? value : "";
  };

  const result = applicationInputSchema.safeParse({
    company: text("company"),
    role: text("role"),
    url: text("url"),
    location: text("location"),
    status: text("status") || "wishlist",
    deadline: text("deadline"),
    notes: text("notes"),
    jobDescription: text("jobDescription"),
  });

  if (result.success) return { ok: true, data: result.data };

  const errors: FieldErrors = {};
  for (const issue of result.error.issues) {
    const field = issue.path[0] as keyof ApplicationInput | undefined;
    if (field && !errors[field]) errors[field] = issue.message;
  }
  return { ok: false, errors };
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

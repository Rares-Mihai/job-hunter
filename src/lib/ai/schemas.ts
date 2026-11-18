import { z } from "zod";

// Shapes of what the AI returns. These are sent to the Claude API as the
// required output format, and the same schemas validate what is stored.

export const jobAnalysisSchema = z.object({
  summary: z
    .string()
    .describe(
      "Two or three plain sentences on what the job is and who it suits.",
    ),
  seniority: z
    .enum(["internship", "junior", "mid", "senior", "unspecified"])
    .describe("Level the posting is aimed at."),
  requirements: z
    .array(
      z.object({
        skill: z
          .string()
          .describe("A single skill, tool or qualification, in a few words."),
        importance: z
          .enum(["must", "nice"])
          .describe(
            "'must' if the posting requires it, 'nice' if it is a plus.",
          ),
      }),
    )
    .describe(
      "Skills and qualifications the posting asks for, most important first.",
    ),
  responsibilities: z
    .array(z.string())
    .describe("What the person will do day to day, as short phrases."),
});

export type JobAnalysis = z.infer<typeof jobAnalysisSchema>;

export const cvMatchSchema = z.object({
  score: z
    .number()
    .int()
    .describe("How well the CV fits the job, as a whole number from 0 to 100."),
  verdict: z
    .string()
    .describe("One sentence explaining the score, addressed to the candidate."),
  matchedSkills: z
    .array(z.string())
    .describe("Required skills that the CV shows evidence of."),
  missingSkills: z
    .array(z.string())
    .describe("Required skills that the CV does not show."),
  highlights: z
    .array(z.string())
    .describe(
      "Things already in the CV that the candidate should emphasize for this job.",
    ),
  suggestions: z
    .array(z.string())
    .describe(
      "Concrete, honest ways to improve the application. Never invent experience.",
    ),
});

export type CvMatch = z.infer<typeof cvMatchSchema>;

export const coverLetterSchema = z.object({
  letter: z
    .string()
    .describe(
      "The body of the cover letter as plain text, paragraphs separated by a blank line. No greeting line, no sign-off, no placeholders in brackets.",
    ),
});

export const interviewPrepSchema = z.object({
  questions: z
    .array(
      z.object({
        question: z
          .string()
          .describe("A question the interviewer is likely to ask."),
        why: z
          .string()
          .describe(
            "One sentence on why this question is likely for this job and this CV.",
          ),
        tip: z
          .string()
          .describe(
            "One or two sentences on how the candidate could answer, using what is in the CV.",
          ),
      }),
    )
    .describe("Six to eight likely interview questions, most important first."),
});

export type InterviewPrep = z.infer<typeof interviewPrepSchema>;

/** Models occasionally return a score outside the range; keep it displayable. */
export function clampScore(score: number): number {
  if (!Number.isFinite(score)) return 0;
  return Math.min(100, Math.max(0, Math.round(score)));
}

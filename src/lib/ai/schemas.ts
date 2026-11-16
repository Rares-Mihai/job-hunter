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

/** Models occasionally return a score outside the range; keep it displayable. */
export function clampScore(score: number): number {
  if (!Number.isFinite(score)) return 0;
  return Math.min(100, Math.max(0, Math.round(score)));
}

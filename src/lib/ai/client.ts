import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod";
import { buildAnalysisPrompt, buildMatchPrompt, type Prompt } from "./prompts";
import {
  clampScore,
  cvMatchSchema,
  jobAnalysisSchema,
  type CvMatch,
  type JobAnalysis,
} from "./schemas";

// Haiku is the fastest and cheapest Claude model, which is plenty for reading
// one job posting. Set ANTHROPIC_MODEL to use a different one.
const DEFAULT_MODEL = "claude-haiku-5-5";

/** Thrown when a result cannot be produced, with a message safe to show the user. */
export class AiError extends Error {}

export function isAiConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

let cachedClient: Anthropic | null = null;

function getClient(): Anthropic {
  if (!isAiConfigured()) {
    throw new AiError(
      "AI is not set up yet. Add ANTHROPIC_API_KEY to the .env file and restart the app.",
    );
  }
  // The SDK reads ANTHROPIC_API_KEY from the environment by itself.
  cachedClient ??= new Anthropic({ timeout: 60_000 });
  return cachedClient;
}

async function askForStructured<Schema extends z.ZodType>(
  prompt: Prompt,
  schema: Schema,
): Promise<z.infer<Schema>> {
  const client = getClient();

  let message;
  try {
    message = await client.messages.parse({
      model: process.env.ANTHROPIC_MODEL || DEFAULT_MODEL,
      max_tokens: 2000,
      system: prompt.system,
      messages: [{ role: "user", content: prompt.user }],
      output_config: { format: zodOutputFormat(schema) },
    });
  } catch (error) {
    throw new AiError(describeApiFailure(error));
  }

  if (message.stop_reason === "max_tokens") {
    throw new AiError(
      "The answer was cut off because it got too long. Try again with a shorter posting.",
    );
  }
  if (message.stop_reason === "refusal" || message.parsed_output === null) {
    throw new AiError(
      "Claude could not analyze this text. Check that it is a job posting and try again.",
    );
  }
  return message.parsed_output as z.infer<Schema>;
}

/** Turns an API failure into one sentence that says what to do about it. */
export function describeApiFailure(error: unknown): string {
  if (error instanceof Anthropic.AuthenticationError) {
    return "The Claude API key was rejected. Check ANTHROPIC_API_KEY in the .env file.";
  }
  if (error instanceof Anthropic.PermissionDeniedError) {
    return "This API key is not allowed to use the selected Claude model.";
  }
  if (error instanceof Anthropic.NotFoundError) {
    return "The Claude model set in ANTHROPIC_MODEL does not exist. Remove it to use the default.";
  }
  if (error instanceof Anthropic.RateLimitError) {
    return "Claude is receiving too many requests right now. Wait a minute and try again.";
  }
  if (error instanceof Anthropic.APIConnectionError) {
    return "Could not reach the Claude API. Check your internet connection and try again.";
  }
  if (error instanceof Anthropic.APIError && error.status === 400) {
    return "The Claude API did not accept the request. If your account has no credit left, add some in the Anthropic console.";
  }
  return "The Claude API returned an error. Try again in a moment.";
}

export async function analyzeJob(jobDescription: string): Promise<JobAnalysis> {
  return askForStructured(
    buildAnalysisPrompt(jobDescription),
    jobAnalysisSchema,
  );
}

export async function matchCv(input: {
  cv: string;
  jobDescription: string;
  analysis: JobAnalysis | null;
}): Promise<CvMatch> {
  const match = await askForStructured(buildMatchPrompt(input), cvMatchSchema);
  return { ...match, score: clampScore(match.score) };
}

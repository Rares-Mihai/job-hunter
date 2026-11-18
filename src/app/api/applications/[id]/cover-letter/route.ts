import { AiError, isAiConfigured, streamCoverLetter } from "@/lib/ai/client";
import { describeLimit, reserveAiRequest } from "@/lib/ai/usage";
import { getApplication, getCv, saveCoverLetter } from "@/lib/applications";
import { getCurrentUser } from "@/lib/session";

// Writes a cover letter draft and streams it to the browser as plain text,
// so the letter appears while it is being written. The finished text is
// saved on the application.

function refuse(status: number, message: string): Response {
  return Response.json({ message }, { status });
}

/**
 * Server actions get this check from Next.js; a hand-written route needs its
 * own. It stops other websites from making a signed-in visitor's browser
 * call this endpoint (and spend AI requests) behind their back.
 */
function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  const host =
    request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export async function POST(
  request: Request,
  context: RouteContext<"/api/applications/[id]/cover-letter">,
): Promise<Response> {
  if (!isSameOrigin(request)) return refuse(403, "Request refused.");

  const user = await getCurrentUser();
  if (!user) return refuse(401, "Sign in again to continue.");

  const { id } = await context.params;
  const application = await getApplication(user.id, id);
  if (!application) return refuse(404, "This application no longer exists.");
  if (application.jobDescription.trim() === "") {
    return refuse(400, "Paste the job posting and save it first.");
  }
  const cv = await getCv(user.id);
  if (cv.text.trim() === "") {
    return refuse(400, "Add your CV on the CV page first.");
  }
  if (!isAiConfigured()) {
    return refuse(
      503,
      "AI is not set up yet. Add ANTHROPIC_API_KEY to the .env file and restart the app.",
    );
  }
  const reservation = await reserveAiRequest(user.id);
  if (reservation !== "ok") return refuse(429, describeLimit(reservation));

  const letter = streamCoverLetter({
    cv: cv.text,
    company: application.company,
    role: application.role,
    jobDescription: application.jobDescription,
    analysis: application.analysis,
  });

  // Get the first piece before answering, so a failure that happens straight
  // away (a rejected key, no credit) can still be reported as an error.
  let first: IteratorResult<string>;
  try {
    first = await letter.next();
  } catch (error) {
    if (error instanceof AiError) return refuse(502, error.message);
    throw error;
  }

  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      let text = "";
      try {
        for (let piece = first; !piece.done; piece = await letter.next()) {
          text += piece.value;
          controller.enqueue(encoder.encode(piece.value));
        }
        if (text.trim() !== "") {
          await saveCoverLetter(user.id, id, text.trim());
        }
        controller.close();
      } catch (error) {
        // The connection to the model broke part-way. Nothing is saved, and
        // the browser sees the stream fail and shows an error.
        controller.error(error);
      }
    },
  });

  return new Response(body, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

// A stand-in for the Claude API, used only by the browser tests. It answers
// POST /v1/messages in the real response format with fixed content, so the
// tests can cover the AI features without an API key or any cost.
import http from "node:http";

const ANSWERS = {
  summary: {
    summary: "A junior role for someone who knows Python and SQL.",
    seniority: "junior",
    requirements: [
      { skill: "Python", importance: "must" },
      { skill: "SQL", importance: "must" },
      { skill: "Docker", importance: "nice" },
    ],
    responsibilities: ["Write backend code"],
  },
  score: {
    score: 72,
    verdict: "You cover the required skills.",
    matchedSkills: ["Python", "SQL"],
    missingSkills: ["Docker"],
    highlights: ["Lead with the database project."],
    suggestions: ["Learn Docker basics."],
  },
  letter: {
    letter:
      "I built a library system with PostgreSQL.\n\nI would like to do the same for you.",
  },
  questions: {
    questions: [
      {
        question: "How would you design a table for loans?",
        why: "The job needs SQL.",
        tip: "Describe your library project.",
      },
    ],
  },
};

const LETTER_PIECES = [
  "I built a library ",
  "system with PostgreSQL.",
  "\n\nI would like to do ",
  "the same for you.",
];

/** Sends the cover letter the way the real API streams: as server-sent events. */
async function streamLetter(response, model) {
  const send = (type, data) =>
    response.write(
      `event: ${type}\ndata: ${JSON.stringify({ type, ...data })}\n\n`,
    );
  response.writeHead(200, { "content-type": "text/event-stream" });
  send("message_start", {
    message: {
      id: "msg_mock",
      type: "message",
      role: "assistant",
      model,
      content: [],
      stop_reason: null,
      stop_sequence: null,
      usage: { input_tokens: 1, output_tokens: 1 },
    },
  });
  send("content_block_start", {
    index: 0,
    content_block: { type: "text", text: "" },
  });
  for (const text of LETTER_PIECES) {
    await new Promise((resolve) => setTimeout(resolve, 150));
    send("content_block_delta", {
      index: 0,
      delta: { type: "text_delta", text },
    });
  }
  send("content_block_stop", { index: 0 });
  send("message_delta", {
    delta: { stop_reason: "end_turn", stop_sequence: null },
    usage: { output_tokens: 20 },
  });
  send("message_stop", {});
  response.end();
}

const port = Number(process.env.MOCK_CLAUDE_PORT ?? 3202);

http
  .createServer((request, response) => {
    if (request.method !== "POST") {
      response.writeHead(200).end("ok");
      return;
    }
    let raw = "";
    request.on("data", (chunk) => (raw += chunk));
    request.on("end", () => {
      const body = JSON.parse(raw);
      if (body.stream) {
        streamLetter(response, body.model);
        return;
      }
      const properties = Object.keys(
        body.output_config?.format?.schema?.properties ?? {},
      );
      const key = Object.keys(ANSWERS).find((name) =>
        properties.includes(name),
      );
      const message = {
        id: "msg_mock",
        type: "message",
        role: "assistant",
        model: body.model,
        content: [{ type: "text", text: JSON.stringify(ANSWERS[key] ?? {}) }],
        stop_reason: "end_turn",
        stop_sequence: null,
        usage: { input_tokens: 1, output_tokens: 1 },
      };
      response
        .writeHead(200, { "content-type": "application/json" })
        .end(JSON.stringify(message));
    });
  })
  .listen(port, "127.0.0.1");

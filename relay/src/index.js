// Linear -> GitHub relay.
// Receives Linear issue webhooks, checks the signature, and when the trigger
// label is newly added to an issue, starts the "linear-agent" GitHub workflow
// through a repository_dispatch event.

const enc = new TextEncoder();

async function hmacHex(secret, body) {
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(body));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function slug(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
}

const reply = (msg, status = 200) => new Response(msg, { status });

export default {
  async fetch(req, env) {
    if (req.method !== "POST") return reply("linear relay up");

    // 1. Verify the request really comes from Linear.
    const raw = await req.text();
    const given = req.headers.get("linear-signature") || "";
    const expected = await hmacHex(env.LINEAR_WEBHOOK_SECRET, raw);
    if (!safeEqual(given, expected)) return reply("bad signature", 401);

    const evt = JSON.parse(raw);

    // 2. Reject replays older than a minute.
    if (Math.abs(Date.now() - Number(evt.webhookTimestamp)) > 60_000) {
      return reply("stale webhook", 401);
    }

    // 3. Only issue create/update events that carry the trigger label.
    if (evt.type !== "Issue" || !["create", "update"].includes(evt.action)) {
      return reply("ignored: not an issue event");
    }
    const issue = evt.data;
    const wanted = (env.TRIGGER_LABEL || "agent").toLowerCase();
    const label = (issue.labels || []).find((l) => l.name.toLowerCase() === wanted);
    if (!label) return reply("ignored: no trigger label");

    // 4. On updates, fire only when the label was just added (not on every edit).
    if (evt.action === "update") {
      const before = evt.updatedFrom && evt.updatedFrom.labelIds;
      if (!before || before.includes(label.id)) return reply("ignored: label not newly added");
    }

    // 5. Optional allowlist: only these Linear user ids may start the agents.
    if (env.ALLOWED_ACTOR_IDS) {
      const allowed = env.ALLOWED_ACTOR_IDS.split(",").map((s) => s.trim());
      if (!evt.actor || !allowed.includes(evt.actor.id)) return reply("ignored: actor not allowed");
    }

    // 6. Pick the repo: per-team map if given, otherwise the default repo.
    let repo = env.GITHUB_REPO;
    if (env.REPO_MAP && issue.team && issue.team.key) {
      const map = JSON.parse(env.REPO_MAP);
      repo = map[issue.team.key] || repo;
    }

    // Branch name contains the issue id so Linear's GitHub integration links the PR.
    const branch = issue.branchName || `${issue.identifier.toLowerCase()}-${slug(issue.title)}`;

    const res = await fetch(`https://api.github.com/repos/${repo}/dispatches`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.GITHUB_TOKEN}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "linear-agent-relay",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        event_type: "linear-agent",
        client_payload: {
          issue_id: issue.id,
          identifier: issue.identifier,
          title: issue.title,
          description: (issue.description || "").slice(0, 20000),
          url: issue.url,
          branch,
        },
      }),
    });

    if (!res.ok) return reply(`github dispatch failed: ${res.status} ${await res.text()}`, 502);
    return reply(`dispatched ${issue.identifier} to ${repo}`);
  },
};

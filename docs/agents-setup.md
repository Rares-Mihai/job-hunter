# Linear → GitHub multi-agent flow

Add the label **`agent`** to a Linear issue and three agents take it from there:

| Agent | Model | Can do |
|---|---|---|
| Planner | Claude Opus | Read the repo, write a plan (no code changes) |
| Coder | Claude Sonnet | Edit code, run tests, commit on a branch |
| Reviewer | Gemini if `GEMINI_API_KEY` is set, else Codex, else Claude Opus | Read the diff + test output, approve or request changes |

The coder fixes the reviewer's findings for up to 2 rounds. Then a PR opens
(ready if approved, **draft** if not) with `Fixes JOB-42` so Linear links it.
The plan, the PR link and the result are posted back as Linear comments.
You review and merge. Linear moves the issue to Done.

```
relay/                      Cloudflare Worker: Linear webhook → GitHub
.github/workflows/linear-agents.yml
.github/agents/
  planner.md coder.md fixer.md reviewer.md   agent instructions (edit freely)
  run.sh                                     runs the agents + review loop
  linear-comment.sh                          posts comments to Linear
```

---

## 1. Put the files in your repo
Copy `.github/` into the repo (e.g. `job-hunter`) and commit it to `main`.
The `relay/` folder can live anywhere (same repo is fine).

## 2. GitHub secrets and variables
Repo → Settings → Secrets and variables → Actions

**Secrets**
| Name | Value |
|---|---|
| `CLAUDE_CODE_OAUTH_TOKEN` | **either this** — uses your Claude Pro/Max plan, no per-request bill. Run `claude setup-token` in a terminal with Claude Code installed and paste the token |
| `ANTHROPIC_API_KEY` | **or this** — from console.anthropic.com, billed per request |
| `GEMINI_API_KEY` | optional — makes Gemini the reviewer (free key at aistudio.google.com/apikey). Pick a model with the `GEMINI_MODEL` variable |
| `OPENAI_API_KEY` | optional — enables Codex as reviewer (billed per request). Without it Claude reviews |
| `LINEAR_API_KEY` | Linear → Settings → Security & access → Personal API keys |
| `AGENT_GH_TOKEN` | optional — fine-grained PAT (Contents + Pull requests: write). Without it the PR still opens, but your other CI workflows won't run on it |

**Variables** (all optional)
| Name | Example |
|---|---|
| `AGENT_SETUP_CMD` | `npm ci` |
| `AGENT_TEST_CMD` | `npm test` |
| `AGENT_MAX_ROUNDS` | `2` |
| `AGENT_BASE_BRANCH` | `main` |

Also: Settings → Actions → General → Workflow permissions →
tick **Allow GitHub Actions to create and approve pull requests**.

## 3. Deploy the relay
```bash
cd relay
# edit GITHUB_REPO in wrangler.toml
npx wrangler login
npx wrangler secret put GITHUB_TOKEN           # fine-grained PAT, Contents: read & write
npx wrangler secret put LINEAR_WEBHOOK_SECRET  # paste after step 4, then redeploy
npx wrangler deploy                            # prints https://linear-agent-relay.<you>.workers.dev
```

## 4. Linear setup
1. Settings → API → Webhooks → **New webhook**
   URL = the worker URL, resource type **Issues**. Copy the signing secret into
   `LINEAR_WEBHOOK_SECRET` (step 3).
2. Create the label `agent`.
3. Settings → Integrations → **GitHub** → connect the repo. In the team's
   workflow settings, set PR opened → *In Review*, PR merged → *Done*.
   The branch name contains the issue id, so linking is automatic.

## 5. Test it
- Quick test without Linear: Actions → *Linear agents* → **Run workflow**,
  fill `identifier` + `title`.
- Real test: make a small Linear issue ("Add a footer with the app version"),
  add the `agent` label, watch the comments appear.

---

## Safety notes
- Issue text goes into the agents' prompts. Anyone who can label issues can
  steer them, so keep the workspace private or set `ALLOWED_ACTOR_IDS` in the relay.
- The agents never get `.github/` write instructions, run with an allowlist of
  tools, and the planner run fails if it touches repo files.
- Every run is capped (`--max-turns`, 60 min timeout, 2 review rounds) to bound cost.
- Nothing merges automatically. You're always the last reviewer.

## Tweaks
- Change models with env vars in `run.sh` (`PLANNER_MODEL`, `CODER_MODEL`, `REVIEWER_MODEL`).
- Prefer zero code? Linear can also assign issues directly to agents like
  GitHub Copilot, Cursor or Codex. This setup is for when you want your own
  planner → coder → reviewer pipeline you control.

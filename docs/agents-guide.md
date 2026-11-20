# Linear → AI agents: how it works and how to use it

Add the label **`agent`** to a Linear issue, and AI agents plan it, code it,
review it and open a pull request. You review and merge.

First-time setup steps are in [agents-setup.md](agents-setup.md). This guide
explains the parts, the daily routine, and how to reuse the setup on other repos.

---

## 1. The big picture

```
Linear issue + label "agent"
        │  webhook
        ▼
Relay (Cloudflare Worker)          checks the request is from Linear, ignores everything else
        │  repository_dispatch
        ▼
GitHub Actions workflow            .github/workflows/linear-agents.yml
        │  runs on: your PC (WSL) or GitHub's servers
        ▼
Planner → Coder → Reviewer ↻ Fixer (max 2 rounds)
        │
        ▼
Pull request "Fixes GIT-7"  →  your CI runs  →  you merge  →  Linear moves the issue to Done
```

---

## 2. What each component does

### Linear: where you work
- You write issues in the **Git_Claude** team (issue ids look like `GIT-7`).
- The **`agent`** label is the start button. Removing it and adding it back starts a new run.
- The agents report back as comments on the issue:
  🤖 started → 🧭 plan → ✅ PR ready (or ⚠️ concerns / ⛔ blocked / ❌ failed).
- Linear's GitHub integration links the PR to the issue and moves the issue to
  **Done** when you merge.

### Linear webhook
- Linear → Settings → API → Webhooks → *job-hunter agents*.
- It sends **every** issue change to the relay. Most are ignored on purpose.
- If something breaks, check its **Delivery failures** section first.

### Relay: `linear-agent-relay` (Cloudflare Worker)
- URL: `https://linear-agent-relay.raresmihai103.workers.dev`
- Code: [`relay/src/index.js`](../relay/src/index.js)
- What it does:
  1. checks the request really comes from Linear (signature),
  2. rejects old or replayed requests,
  3. continues only when the `agent` label was **just added**,
  4. picks the repo (`GITHUB_REPO`, or `REPO_MAP` by Linear team),
  5. tells GitHub to start the workflow.
- Its settings (Cloudflare → worker → Settings → Variables and Secrets):

| Name | Type | What |
|---|---|---|
| `GITHUB_REPO` | Text | `Rares-Mihai/job-hunter` |
| `GITHUB_TOKEN` | Secret | fine-grained token `linear-relay`, Contents: read & write |
| `LINEAR_WEBHOOK_SECRET` | Secret | signing secret from the Linear webhook |
| `REPO_MAP` | Text, optional | Linear team key → repo, for more repos (see section 6) |
| `TRIGGER_LABEL` | Text, optional | another label instead of `agent` |
| `ALLOWED_ACTOR_IDS` | Text, optional | only these Linear users may start runs |

- Cloudflare → worker → **Observability/Logs** shows each request and the reply
  (`dispatched GIT-7`, `ignored: no trigger label`, ...).

### GitHub Actions workflow: the conductor
File: [`.github/workflows/linear-agents.yml`](../.github/workflows/linear-agents.yml)

Steps, in order (each one shows up separately in the run's log):

| Step | What happens |
|---|---|
| Install agent CLIs | installs Claude Code, Codex and Gemini CLIs |
| Project setup | runs `AGENT_SETUP_CMD` (`npm ci`) |
| Prepare branch and task file | creates the branch (e.g. `git-7-closing-this-week-filter`) and writes the issue to `.agent/issue.md` |
| Tell Linear the agents started | 🤖 comment |
| Agent 1: planner | writes `.agent/plan.md` |
| Post plan to Linear | 🧭 comment |
| Stop if the planner is blocked | ⛔ if the issue was too vague |
| Agent 2: coder | writes the code and commits |
| Agent 3: reviewer (+ fix rounds) | runs tests, reviews, the fixer fixes, repeats (max 2 rounds) |
| Push and open pull request | pushes the branch, opens the PR (draft if the reviewer still had concerns), ✅/⚠️ comment |
| Report failure to Linear | ❌ comment if any step failed |

You can also start it by hand: GitHub → Actions → *Linear agents* → **Run workflow**
(issue id + title). Linear comments are skipped then.

### The agents
Their instructions are plain text files in [`.github/agents/`](../.github/agents/).
Edit them to change how they behave. [`run.sh`](../.github/agents/run.sh) runs them.

| Agent | Model | Can | Instructions |
|---|---|---|---|
| **Planner** | Claude Opus | read the repo, write the plan. Cannot change code (the run stops if it does) | `planner.md` |
| **Coder** | Claude Sonnet | edit files, run npm/tests, commit. Cannot push or touch `.github/` | `coder.md` |
| **Reviewer** | chosen by `AGENT_REVIEWER` (now: Antigravity) | read only. Answers `VERDICT: APPROVE` or `VERDICT: CHANGES_REQUESTED` | `reviewer.md` |
| **Fixer** | Claude Sonnet | same as coder, fixes the reviewer's findings | `fixer.md` |

Reviewer options (`AGENT_REVIEWER` variable):

| Value | Uses | Needs |
|---|---|---|
| `agy` | Antigravity CLI with your Google AI subscription | self-hosted runner where you signed in to `agy` |
| `gemini` | Gemini CLI | `GEMINI_API_KEY` secret (free key from aistudio.google.com/apikey) |
| `codex` | OpenAI Codex | `OPENAI_API_KEY` secret (paid) |
| `claude` | Claude Opus | nothing extra (uses your Claude plan) |
| empty | first available: gemini → codex → claude | |

The reviewer is deliberately a different model from the coder, so it catches different mistakes.

### Runner: where the work physically happens
- Now: **your PC**, in WSL, folder `~/actions-runner`, label `agent-pc`.
  Chosen by the repo variable `AGENT_RUNNER = agent-pc`.
- Without `AGENT_RUNNER`: GitHub's servers (`ubuntu-latest`). Always available,
  but the reviewer can't be Antigravity there.
- While `AGENT_RUNNER` is set, the PC must be on with the runner running,
  otherwise runs wait in the queue (and are cancelled after 24 h).
- The PC needs: `agy` signed in, and `gh` installed (`sudo apt install -y gh`).

### GitHub repo settings
Settings → Secrets and variables → Actions:

| Kind | Name | Value / purpose |
|---|---|---|
| Secret | `CLAUDE_CODE_OAUTH_TOKEN` | Claude login for the agents (from `claude setup-token`). Or `ANTHROPIC_API_KEY` instead |
| Secret | `LINEAR_API_KEY` | lets the workflow comment on Linear issues |
| Secret, optional | `GEMINI_API_KEY`, `OPENAI_API_KEY` | other reviewers |
| Secret, optional | `AGENT_GH_TOKEN` | token so your CI runs on agent PRs without approval |
| Variable | `AGENT_SETUP_CMD` | `npm ci` |
| Variable | `AGENT_TEST_CMD` | `npm run lint && npm run typecheck && npm test` |
| Variable | `AGENT_RUNNER` | `agent-pc` (your PC) or empty (GitHub's servers) |
| Variable | `AGENT_REVIEWER` | `agy`, `gemini`, `codex`, `claude` or empty |
| Variable, optional | `AGY_MODEL`, `GEMINI_MODEL` | pick a specific model |
| Variable, optional | `AGENT_MAX_ROUNDS` | review/fix rounds, default `2` |

When typing variable values, don't press Enter at the end: a hidden line break
breaks them (that's why the first PC run got stuck in the queue).

Settings → Actions → General:
- **Allow GitHub Actions to create and approve pull requests**: on.
- **Require approval for all external contributors**: on (important with a
  runner on your PC and a public repo).

### Your CI (`ci.yml`)
Runs on every PR: lint, type-check, unit tests, build, and browser tests.
The agents don't run the browser tests, so CI is the final check.
On agent PRs, click **Approve and run workflows** to start it.

---

## 3. Daily routine

1. **Start the runner** (while using your PC as runner):
   ```bash
   cd ~/actions-runner && ./run.sh     # wait for "Listening for Jobs", keep it open
   ```
2. **Write the issue in Linear** (Git_Claude team):
   - Title: what you want, in a few words.
   - Description: what the user sees, and how to check it's done, e.g.
     "Unit tests cover A, B and C".
   - Add the **agent** label.
3. **~2 minutes:** read the 🧭 plan on the issue. If it's wrong: remove the label,
   improve the description, add the label back.
4. **~10 minutes:** a PR appears (link in the ✅ comment).
5. **Review:** on GitHub, click *Approve and run workflows*, look at *Files changed*,
   wait for CI to be green, then **Merge**. Linear moves the issue to Done.

### Writing good issues
- One issue = one small thing ("Export as CSV", not "redo the stats page").
- Always say how to check it: the reviewer checks the code against exactly that.
- Issues that touch the same files: run them one at a time.
- Design decisions, AI prompts, anything you're unsure about: decide first (in a
  chat with Claude), then give the agents the clear task.

Example:
> **Closing this week filter**
> Next to the search box, add a toggle "Closing this week" that shows only
> wishlist cards whose deadline is within the next 7 days (today included).
> Cards without a deadline are hidden while it's on. Works together with search.
> Unit tests: deadline today, in 7 days (shown), in 8 days (hidden), past
> deadline (hidden), no deadline (hidden).

---

## 4. When something goes wrong

| You see | Meaning | What to do |
|---|---|---|
| No 🤖 comment after a minute | the run didn't start | check Linear webhook delivery failures and the Cloudflare logs. Was the label added (not just present)? |
| Run stays **Queued** | no runner picked it up | start `./run.sh` in WSL. Check `AGENT_RUNNER` has no trailing line break |
| ⛔ BLOCKED | issue too vague | add details, re-add the label |
| ⚠️ Draft PR | reviewer still had concerns after 2 rounds | read "Final review" in the PR. Fix it yourself, or close the PR and write a clearer issue |
| ❌ Failed | a step crashed | open the run link, see which step is red, read its log |
| `agy gave no review` | Antigravity not signed in on the PC | in WSL run `agy`, sign in, test with `agy -p "Reply PONG"` |
| `gh: command not found` | GitHub CLI missing on the PC | `sudo apt install -y gh` |
| `No Claude login` | Claude secret missing | add `CLAUDE_CODE_OAUTH_TOKEN` (Actions secrets, not Agents) |
| Red CI check that passes on **Re-run failed jobs** | flaky test | merge if the re-run is green |
| Red CI twice in a row | real problem | ask Claude to look at the run |

---

## 5. Switching modes

| Mode | `AGENT_RUNNER` | `AGENT_REVIEWER` | Needs |
|---|---|---|---|
| **PC + Antigravity** (current) | `agent-pc` | `agy` | PC on, `./run.sh` running |
| **Cloud + Claude** | *(delete it)* | `claude` | nothing |
| **Cloud + Gemini** | *(delete it)* | `gemini` | `GEMINI_API_KEY` secret |

### Optional: start the runner automatically with Windows
In WSL:
```bash
printf '[boot]\nsystemd=true\n' | sudo tee /etc/wsl.conf
```
In PowerShell: `wsl --shutdown`, then open WSL again and:
```bash
cd ~/actions-runner
sudo ./svc.sh install ares
sudo ./svc.sh start
sudo ./svc.sh status        # "active (running)"
```
Then Win+R → `shell:startup` → new shortcut with target `wsl.exe -e sleep infinity`
(set *Run: Minimized*). WSL and the runner now start when you log in to Windows.

---

## 6. Using it on other repos

One relay serves all repos. Each repo gets its own copy of the workflow and settings.

1. **Copy files** into the new repo and commit to `main`:
   `.github/agents/` and `.github/workflows/linear-agents.yml`
   (optionally `docs/agents-setup.md` and this guide).
2. **Repo settings** (section 2, "GitHub repo settings"):
   - Secrets: `CLAUDE_CODE_OAUTH_TOKEN`, `LINEAR_API_KEY`.
   - Variables: `AGENT_SETUP_CMD` / `AGENT_TEST_CMD` with **that project's**
     commands (e.g. `pip install -r requirements.txt` / `pytest`), plus
     `AGENT_RUNNER` / `AGENT_REVIEWER` if wanted.
   - Actions → General: allow Actions to create PRs; for public repos,
     require approval for all external contributors.
3. **Linear:** create a team for the repo (e.g. key `DEV`) and give it an
   `agent` label. The team decides which repo an issue goes to.
4. **Relay:**
   - Cloudflare → worker → Settings → Variables: add `REPO_MAP` (Text):
     `{"GIT":"Rares-Mihai/job-hunter","DEV":"Rares-Mihai/<new-repo>"}`
   - GitHub → Settings → Developer settings → Fine-grained tokens →
     `linear-relay` → **Edit** → add the new repo (Contents: read & write).
5. **Runner:** on a personal account a self-hosted runner belongs to one repo.
   Either register another one on your PC in its own folder
   (`~/actions-runner-<repo>`, same steps, label `agent-pc`), or leave
   `AGENT_RUNNER` empty in that repo so it runs on GitHub's servers.
6. **Optional:** Linear → Settings → Integrations → GitHub → add the repo, so
   PRs link to issues and close them on merge.

---

## 7. Files at a glance

| Path | What |
|---|---|
| `.github/workflows/linear-agents.yml` | the workflow (conductor) |
| `.github/agents/run.sh` | runs planner, coder, review loop |
| `.github/agents/planner.md` | planner instructions |
| `.github/agents/coder.md` | coder instructions |
| `.github/agents/fixer.md` | fixer instructions |
| `.github/agents/reviewer.md` | reviewer instructions |
| `.github/agents/linear-comment.sh` | posts comments to Linear |
| `relay/src/index.js` | relay code (deployed by hand in Cloudflare) |
| `relay/wrangler.toml` | relay config, if you deploy it with the CLI |
| `docs/agents-setup.md` | first-time setup |
| `docs/agents-guide.md` | this guide |

If you change `relay/src/index.js`, paste it into Cloudflare again (*Edit code* → *Deploy*).

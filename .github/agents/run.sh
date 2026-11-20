#!/usr/bin/env bash
# Orchestrates the three agents. Called by .github/workflows/linear-agents.yml
# Usage: run.sh plan | code | review-loop
set -euo pipefail

A=.github/agents
BASE="${BASE_BRANCH:-main}"
PLANNER_MODEL="${PLANNER_MODEL:-claude-opus-5-5}"
CODER_MODEL="${CODER_MODEL:-claude-sonnet-5-5}"
REVIEWER_MODEL="${REVIEWER_MODEL:-claude-opus-5-5}"   # only used when no Gemini/OpenAI key
MAX_ROUNDS="${MAX_REVIEW_ROUNDS:-2}"

# Empty secrets arrive as empty strings; unset them so each CLI picks the right login.
for v in ANTHROPIC_API_KEY CLAUDE_CODE_OAUTH_TOKEN OPENAI_API_KEY GEMINI_API_KEY; do
  [ -z "${!v:-}" ] && unset "$v"
done
if [ -z "${ANTHROPIC_API_KEY:-}" ] && [ -z "${CLAUDE_CODE_OAUTH_TOKEN:-}" ]; then
  echo "No Claude login: add the CLAUDE_CODE_OAUTH_TOKEN or ANTHROPIC_API_KEY secret."; exit 1
fi

READ_TOOLS="Read,Glob,Grep,Bash(git log:*),Bash(git diff:*),Bash(git show:*),Bash(ls:*)"
CODE_TOOLS="Read,Write,Edit,MultiEdit,Glob,Grep,Bash(git add:*),Bash(git commit:*),Bash(git status:*),Bash(git diff:*),Bash(git log:*),Bash(npm:*),Bash(npx:*),Bash(pnpm:*),Bash(yarn:*),Bash(node:*),Bash(python:*),Bash(python3:*),Bash(pytest:*),Bash(ls:*)"

claude_run() { # model tools max_turns prompt
  claude -p "$4" --model "$1" --allowedTools "$2" --max-turns "$3" --output-format text
}

commit_leftovers() { # message
  if [ -n "$(git status --porcelain)" ]; then
    git add -A && git commit -m "$1"
  fi
}

run_tests() {
  rm -f .agent/tests.txt .agent/tests.status
  [ -z "${TEST_CMD:-}" ] && return 0
  if bash -c "$TEST_CMD" > .agent/tests.txt 2>&1; then
    echo pass > .agent/tests.status
  else
    echo fail > .agent/tests.status
  fi
  echo "tests: $(cat .agent/tests.status)"
}

# Everything the reviewer needs, in one file: task, plan, test results, full diff.
review_bundle() {
  {
    echo "=== REVIEW INSTRUCTIONS ==="; cat "$A/reviewer.md"; echo
    echo "=== ISSUE (.agent/issue.md) ==="; cat .agent/issue.md; echo
    echo "=== PLAN (.agent/plan.md) ==="; cat .agent/plan.md; echo
    echo "=== TESTS: $(cat .agent/tests.status 2>/dev/null || echo 'not run') ==="
    tail -n 150 .agent/tests.txt 2>/dev/null; echo
    echo "=== COMMITS ==="; git log --oneline "origin/$BASE..HEAD"; echo
    echo "=== DIFF (git diff origin/$BASE...HEAD) ==="; git diff "origin/$BASE...HEAD"
  } > .agent/review-input.md
}

review() { # round
  if [ -n "${GEMINI_API_KEY:-}" ]; then
    echo "reviewer: Gemini (${GEMINI_MODEL:-default model})"
    review_bundle
    # plan = read-only approval mode: Gemini can read files but never edit or run commands.
    gemini -p "Review the change below. Everything you need is in this input; you may also read files in the repo for context. Reply with the review only, first line VERDICT: APPROVE or VERDICT: CHANGES_REQUESTED." \
      --approval-mode plan --skip-trust ${GEMINI_MODEL:+-m "$GEMINI_MODEL"} \
      < .agent/review-input.md > .agent/review.md
  elif [ -n "${OPENAI_API_KEY:-}" ]; then
    echo "reviewer: Codex"
    CODEX_API_KEY="$OPENAI_API_KEY" codex exec \
      --sandbox read-only \
      --output-last-message .agent/review.md \
      "$(cat "$A/reviewer.md")"
  else
    echo "reviewer: Claude ($REVIEWER_MODEL)"
    claude_run "$REVIEWER_MODEL" "$READ_TOOLS,Write" 30 \
      "Follow $A/reviewer.md exactly. BASE_BRANCH is $BASE. Write your full review (starting with the VERDICT line) to .agent/review.md and do not create or edit any other file."
  fi
  cp .agent/review.md ".agent/review-$1.md"
}

case "${1:-}" in
  plan)
    claude_run "$PLANNER_MODEL" "$READ_TOOLS,Write" 30 \
      "Follow $A/planner.md. The issue is in .agent/issue.md. Write the plan to .agent/plan.md only."
    test -s .agent/plan.md || { echo "Planner wrote no plan"; exit 1; }
    if [ -n "$(git status --porcelain)" ]; then
      echo "Planner changed repository files — aborting."; git status; exit 1
    fi
    if head -1 .agent/plan.md | grep -q '^BLOCKED:'; then
      echo blocked > .agent/verdict
    fi
    ;;

  code)
    claude_run "$CODER_MODEL" "$CODE_TOOLS" 60 \
      "Follow $A/coder.md. Issue: .agent/issue.md. Plan: .agent/plan.md. Issue id: $IDENT."
    commit_leftovers "$IDENT: agent changes"
    if [ "$(git rev-list --count "origin/$BASE..HEAD")" -eq 0 ]; then
      echo "Coder made no commits"; exit 1
    fi
    ;;

  review-loop)
    round=1
    while :; do
      run_tests
      review "$round"
      verdict=$(grep -m1 -oE 'VERDICT: (APPROVE|CHANGES_REQUESTED)' .agent/review.md | cut -d' ' -f2 || true)
      tests=$(cat .agent/tests.status 2>/dev/null || echo none)
      echo "round $round: verdict=${verdict:-unparsed} tests=$tests"

      if [ "$verdict" = "APPROVE" ] && [ "$tests" != "fail" ]; then
        echo approved > .agent/verdict; break
      fi
      if [ "$round" -ge "$MAX_ROUNDS" ]; then
        echo needs-human > .agent/verdict; break
      fi

      claude_run "$CODER_MODEL" "$CODE_TOOLS" 40 \
        "Follow $A/fixer.md. This is fix round $round. Issue id: $IDENT."
      commit_leftovers "$IDENT: address review round $round"
      round=$((round + 1))
    done
    ;;

  *) echo "usage: $0 plan|code|review-loop"; exit 2 ;;
esac

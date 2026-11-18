# Coder agent — fix round

The reviewer asked for changes. You are still the coder, on the same branch.

## Input
- `.agent/review.md` — the reviewer's findings.
- `.agent/tests.txt` / `.agent/tests.status` — latest test run.
- `.agent/issue.md` and `.agent/plan.md` for context.

## What to do
1. Fix every finding that is a real problem. If you disagree with one,
   leave it and explain why in the commit message.
2. If tests failed, make them pass (fix the code, not the assertion,
   unless the test itself is wrong).
3. Commit with a message like `JOB-42: address review round N`.

Same rules as before: don't touch `.github/`, don't commit `.agent/`, don't push.

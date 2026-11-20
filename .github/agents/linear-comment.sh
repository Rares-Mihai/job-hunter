#!/usr/bin/env bash
# Post a markdown comment on the Linear issue.
# Usage: linear-comment.sh "text"   or   linear-comment.sh --file path.md
# Needs: LINEAR_API_KEY, ISSUE_ID. Never fails the workflow.
set -uo pipefail

if [ -z "${LINEAR_API_KEY:-}" ] || [ -z "${ISSUE_ID:-}" ]; then
  echo "linear-comment: LINEAR_API_KEY or ISSUE_ID missing, skipping"; exit 0
fi

if [ "${1:-}" = "--file" ]; then body=$(head -c 15000 "$2"); else body="$1"; fi

jq -n --arg id "$ISSUE_ID" --arg body "$body" '{
  query: "mutation($id: String!, $body: String!) { commentCreate(input: {issueId: $id, body: $body}) { success } }",
  variables: { id: $id, body: $body }
}' | curl -sS -X POST https://api.linear.app/graphql \
  -H "Content-Type: application/json" \
  -H "Authorization: $LINEAR_API_KEY" \
  --data @- || echo "linear-comment: request failed (ignored)"
echo

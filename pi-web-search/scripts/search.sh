#!/usr/bin/env bash
# search.sh — Search DuckDuckGo and return stripped HTML results.
# Usage: search.sh "<query>"
# The LLM reads the stripped output and extracts result links/snippets.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
QUERY="$1"
if [[ -z "${QUERY:-}" ]]; then
  echo "Usage: search.sh <query>" >&2
  exit 1
fi
ENCODED=$(node -e "process.stdout.write(encodeURIComponent(process.argv[1]))" "$QUERY")
node "$SCRIPT_DIR/fetch-url.mjs" "https://html.duckduckgo.com/html/?q=$ENCODED" markdown

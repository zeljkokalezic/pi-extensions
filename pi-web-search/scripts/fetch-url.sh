#!/usr/bin/env bash
# fetch-url.sh — Fetch a URL and return clean text content.
# Usage: fetch-url.sh <url> [text|markdown]
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
node "$SCRIPT_DIR/fetch-url.mjs" "$@"

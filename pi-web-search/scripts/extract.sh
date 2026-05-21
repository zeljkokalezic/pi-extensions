#!/usr/bin/env bash
# extract.sh — Fetch a URL and return clean text content.
# Usage: extract.sh <url> [text|markdown]
# Alias for fetch-url.sh — same tool, different name for skill clarity.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
node "$SCRIPT_DIR/fetch-url.mjs" "$@"

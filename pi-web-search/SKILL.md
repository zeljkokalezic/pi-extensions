---
name: web-search
description: >
  Perform web searches using DuckDuckGo HTML and summarize results from multiple sources.
  Use when the user asks to search the web, look something up online, find current information,
  research a topic, check recent news, or find information that may be beyond the model's training data.
version: 1.0.0
category: web, research
allowed-tools: bash, read
---

# Web Search

Search the web using DuckDuckGo's HTML interface and extract content from result pages.
Uses the same approach as Mercury-Agent: Node.js native `fetch()` with a simple bot User-Agent
that avoids CAPTCHA challenges.

## Workflow

### 1. Search

Run the search script with a query. This fetches DuckDuckGo HTML results and strips them to readable text:

```bash
bash "SKILL_DIR/scripts/search.sh '<query>'"
```

The output is stripped HTML with markdown-style links. Read it to find result titles, URLs, and snippets.

### 2. Select sources

From the search results, pick the top 2–4 most relevant and reliable results. Prefer:

- Official documentation and primary sources
- Reputable publications and well-known sites
- Recent content for time-sensitive topics

### 3. Fetch content

For each selected source, extract the page content:

```bash
bash "SKILL_DIR/scripts/extract.sh '<url>'"
```

This fetches the page using Node.js `fetch()` and strips HTML to clean markdown-like text.
For JSON APIs, it pretty-prints the response.

### 4. Cross-check

When possible, verify key facts across at least 2 independent sources.

### 5. Respond

Return a concise answer with:

- Source URLs inline or at the bottom
- Clear caveats for uncertain or conflicting information
- Attribution to specific sources for key claims

## Rules

- **Prefer reliable sources:** Official docs > reputable publications > forums/user content.
- **Be honest about uncertainty:** If sources conflict or information is unclear, say so explicitly.
- **Include source URLs:** Always provide links so the user can verify.
- **No fabricated citations:** Only reference pages you actually fetched.
- **Respect rate limits:** Space out fetches if making many requests.
- **Handle failures gracefully:** If a page fails to load, skip it and try the next result.
- **Keep it concise:** Summarize findings rather than dumping raw content.

## Silent execution

Do not narrate intermediate steps. The user only wants the final summary.
- Run search/extract commands without explanatory preamble.
- If a command fails, silently try the alternative (e.g. `bash /path` instead of `bash "/path"`).
- Do not announce what you're about to do or comment on results before the final answer.
- Output only the final summarized answer to the user.

## Implementation notes

- Uses `User-Agent: Mercury-Agent/0.1.0` which avoids DuckDuckGo CAPTCHA challenges
  (browser-like User-Agents trigger CAPTCHAs)
- `SKILL_DIR` resolves to this skill's directory at runtime
- Content is capped at 15KB per page (truncated with `... (truncated)`)
- Requests timeout after 30 seconds
- Script path failure (`"No such file"` with quoted args) is a known bash issue —
  re-run with unquoted path: `bash /absolute/path/to/script.sh 'query'`

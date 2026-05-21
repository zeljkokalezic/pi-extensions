#!/usr/bin/env node
/**
 * fetch-url.mjs — Fetch a URL and return its content as text.
 * 1:1 port of Mercury's fetch_url tool for pi skill usage.
 *
 * Usage: node fetch-url.mjs <url> [text|markdown]
 */

const MAX_CONTENT_LENGTH = 15000;

function stripHtml(html) {
  let text = html;

  text = text.replace(/<script[\s\S]*?<\/script>/gi, "");
  text = text.replace(/<style[\s\S]*?<\/style>/gi, "");
  text = text.replace(/<nav[\s\S]*?<\/nav>/gi, "");
  text = text.replace(/<footer[\s\S]*?<\/footer>/gi, "");
  text = text.replace(/<header[\s\S]*?<\/header>/gi, "");

  text = text.replace(/<br\s*\/?>/gi, "\n");
  text = text.replace(/<\/p>/gi, "\n");
  text = text.replace(/<\/h[1-6]>/gi, "\n");
  text = text.replace(/<\/li>/gi, "\n");
  text = text.replace(/<\/div>/gi, "\n");
  text = text.replace(/<hr\s*\/?>/gi, "\n---\n");

  text = text.replace(
    /<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi,
    "[$2]($1)"
  );
  text = text.replace(/<img[^>]*alt="([^"]*)"[^>]*>/gi, "[image: $1]");
  text = text.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, "`$1`");
  text = text.replace(
    /<pre[^>]*>([\s\S]*?)<\/pre>/gi,
    "\n```\n$1\n```\n"
  );
  text = text.replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, "**$1**");
  text = text.replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, "*$1*");

  text = text.replace(/<[^>]+>/g, "");

  text = text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");

  text = text.replace(/\n{3,}/g, "\n\n");
  text = text.trim();

  return text;
}

async function main() {
  const args = process.argv.slice(2);
  const url = args[0];
  const outputFormat = args[1] ?? "markdown";

  if (!url) {
    console.error("Usage: fetch-url.mjs <url> [text|markdown]");
    process.exit(1);
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    const resp = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mercury-Agent/0.1.0",
        Accept: "text/html,application/json,text/plain",
      },
    });

    clearTimeout(timeout);

    if (!resp.ok) {
      console.log(`HTTP ${resp.status} ${resp.statusText} for ${url}`);
      return;
    }

    const contentType = resp.headers.get("content-type") || "";
    const body = await resp.text();

    // JSON → pretty print
    if (contentType.includes("application/json")) {
      try {
        const json = JSON.parse(body);
        const formatted = JSON.stringify(json, null, 2);
        const output =
          formatted.length > MAX_CONTENT_LENGTH
            ? formatted.slice(0, MAX_CONTENT_LENGTH) + "\n... (truncated)"
            : formatted;
        console.log(output);
      } catch {
        console.log(body.slice(0, MAX_CONTENT_LENGTH));
      }
      return;
    }

    // HTML → markdown via stripHtml
    if (contentType.includes("text/html") && outputFormat === "markdown") {
      const text = stripHtml(body);
      const output =
        text.length > MAX_CONTENT_LENGTH
          ? text.slice(0, MAX_CONTENT_LENGTH) + "\n... (truncated)"
          : text;
      console.log(output);
      return;
    }

    // Plain text
    const output =
      body.length > MAX_CONTENT_LENGTH
        ? body.slice(0, MAX_CONTENT_LENGTH) + "\n... (truncated)"
        : body;
    console.log(output);
  } catch (err) {
    if (err.name === "AbortError") {
      console.log(`Request to ${url} timed out after 30 seconds.`);
    } else {
      console.log(`Error fetching ${url}: ${err.message}`);
    }
    process.exit(1);
  }
}

main();

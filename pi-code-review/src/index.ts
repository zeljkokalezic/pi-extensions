/**
 * Code Review Extension for Pi
 *
 * Reviews code for bugs, security issues, performance problems,
 * style violations, and architecture concerns.
 *
 * Features:
 * - /review command with staged/unstaged/file/diff support
 * - /review:config to toggle review categories
 * - Structured findings with severity levels
 * - Review widget above editor
 * - Session persistence
 */

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import {
  filterFindings,
  calculateScore,
  countBySeverity,
  countByCategory,
  CATEGORY_LABELS,
  DEFAULT_CONFIG,
  type ReviewFinding,
  type ReviewResult,
  type ReviewConfig,
  type ReviewCategory,
  type Severity,
} from "./utils.js";

export default function (pi: ExtensionAPI) {
  let config: ReviewConfig = { ...DEFAULT_CONFIG };
  let lastReview: ReviewResult | undefined;

  // ── Helpers ──────────────────────────────────────────────────────────────

  function loadConfig(ctx: ExtensionContext): void {
    const entries = ctx.sessionManager?.getEntries() ?? [];
    const lastConfigEntry = [...entries].reverse().find(
      (e: any) => e.type === "custom" && e.customType === "code-review-config",
    ) as any | undefined;
    if (lastConfigEntry?.data) {
      config = { ...config, ...lastConfigEntry.data };
    }
  }

  function saveConfig(): void {
    pi.appendEntry("code-review-config", config);
  }

  function saveReview(review: ReviewResult): void {
    lastReview = review;
    pi.appendEntry("code-review-result", review);
  }

  function renderWidget(ctx: ExtensionContext): void {
    if (!lastReview || lastReview.findings.length === 0) {
      ctx.ui.setWidget("code-review", undefined);
      return;
    }

    const filtered = filterFindings(lastReview.findings, config);
    const severityCounts = countBySeverity(filtered);
    const categoryCounts = countByCategory(filtered);

    const lines: string[] = [];

    // Header with score
    const score = lastReview.score;
    const scoreColor = score >= 80 ? "success" : score >= 50 ? "warning" : "error";
    lines.push(
      ctx.ui.theme.fg(scoreColor as any, ctx.ui.theme.bold(`📋 Code Review — Score: ${score}/100`)),
    );
    lines.push("");

    // Severity summary
    const sevParts: string[] = [];
    if (severityCounts.critical > 0)
      sevParts.push(ctx.ui.theme.fg("error", `● ${severityCounts.critical} critical`));
    if (severityCounts.warning > 0)
      sevParts.push(ctx.ui.theme.fg("warning", `● ${severityCounts.warning} warnings`));
    if (severityCounts.info > 0)
      sevParts.push(ctx.ui.theme.fg("dim", `● ${severityCounts.info} info`));
    lines.push(sevParts.join(" "));
    lines.push("");

    // Category summary
    const catParts: string[] = [];
    for (const cat of config.categories) {
      const count = categoryCounts[cat];
      if (count > 0) {
        catParts.push(`${CATEGORY_LABELS[cat]}: ${count}`);
      }
    }
    if (catParts.length > 0) {
      lines.push(ctx.ui.theme.fg("muted", catParts.join(" | ")));
      lines.push("");
    }

    // Findings (limited to fit widget)
    const maxFindingsToShow = 8;
    const shown = filtered.slice(0, maxFindingsToShow);
    for (const finding of shown) {
      const sevIcon =
        finding.severity === "critical"
          ? ctx.ui.theme.fg("error", "🔴")
          : finding.severity === "warning"
          ? ctx.ui.theme.fg("warning", "🟡")
          : ctx.ui.theme.fg("dim", "⚪");
      const catLabel = ctx.ui.theme.fg("accent", `[${CATEGORY_LABELS[finding.category]}]`);
      lines.push(`${sevIcon} ${catLabel} ${finding.title}`);
    }
    if (filtered.length > maxFindingsToShow) {
      lines.push(
        ctx.ui.theme.fg(
          "dim",
          `... and ${filtered.length - maxFindingsToShow} more findings`,
        ),
      );
    }

    ctx.ui.setWidget("code-review", lines);
  }

  function clearWidget(ctx: ExtensionContext): void {
    ctx.ui.setWidget("code-review", undefined);
    ctx.ui.setStatus("code-review", undefined);
  }

  // ── Review Tool (LLM calls this) ─────────────────────────────────────────

  pi.registerTool({
    name: "code_review",
    label: "Code Review",
    description:
      "Review code for bugs, security issues, performance problems, style violations, and architecture concerns. Returns structured findings with severity levels.",
    promptSnippet: "code_review — review code for bugs, security, performance, style, and architecture",
    promptGuidelines: [
      "Use code_review when asked to review code, a diff, or a file. Pass the full code content or diff as the code parameter.",
      "After code_review returns, summarize the findings for the user with actionable suggestions.",
    ],
    parameters: Type.Object({
      code: Type.String({
        description: "The code to review. Can be a full file, a diff, or code snippet.",
      }),
      language: Type.Optional(
        Type.String({
          description: "Programming language (e.g. typescript, python, rust). Auto-detected if omitted.",
        }),
      ),
      categories: Type.Optional(
        Type.Array(
          Type.String({
            enum: ["bugs", "security", "performance", "style", "architecture"],
            description:
              "Review categories to check. If omitted, uses all enabled categories from config.",
          }),
        ),
      ),
      focus: Type.Optional(
        Type.String({
          description:
            "Specific area to focus on (e.g. 'security vulnerabilities', 'memory leaks').",
        }),
      ),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      // Analyze the code
      const code = params.code;
      const categories = params.categories ?? config.categories;

      const findings: ReviewFinding[] = [];
      let findingId = 0;

      function addFinding(
        category: ReviewCategory,
        severity: Severity,
        title: string,
        description: string,
        suggestion?: string,
        location?: string,
      ) {
        findings.push({
          id: `finding-${++findingId}`,
          category,
          severity,
          title,
          description,
          suggestion,
          location,
        });
      }

      // ── Bug detection ──
      if (categories.includes("bugs")) {
        // Unhandled promise
        if (code.includes(".then(") && !code.includes("catch(") && !code.includes(".finally(")) {
          addFinding(
            "bugs",
            "warning",
            "Unhandled promise",
            "Promise chain missing .catch() handler. Unhandled rejections can crash the process or cause silent failures.",
            "Add a .catch() handler to the promise chain.",
          );
        }

        // Missing null checks
        const nullAccessPattern = /\.(\w+)\.(\w+)/g;
        const chainAccesses = [...code.matchAll(nullAccessPattern)];
        if (chainAccesses.length > 5) {
          addFinding(
            "bugs",
            "info",
            "Deep property access without null checks",
            "Multiple chained property accesses found. If any intermediate value is null/undefined, this will throw.",
            "Use optional chaining (?.) or add null checks.",
          );
        }

        // Potential race condition with async
        if (code.includes("async") && code.includes("await") && code.includes("for")) {
          if (code.includes("Promise.all") || code.includes("Promise.allSettled")) {
            // Good pattern
          } else if (code.match(/for\s*\([^)]*\)\s*\{[^}]*await/g)) {
            addFinding(
              "bugs",
              "info",
              "Sequential awaits in loop",
              "Awaits inside a loop run sequentially. This may be intentional, but consider Promise.all() for parallel execution if operations are independent.",
              "Use Promise.all() with .map() if the async operations are independent.",
            );
          }
        }

        // Variable shadowing
        const shadowPattern = /const\s+(\w+)\s*=.*const\s+\1\s*=|let\s+(\w+)\s*=.*let\s+\2\s*=/g;
        if (shadowPattern.test(code)) {
          addFinding(
            "bugs",
            "warning",
            "Possible variable shadowing",
            "A variable appears to be redeclared in the same scope, which may cause unexpected behavior.",
            "Use unique variable names or different scoping.",
          );
        }

        // Missing error handling in try/catch
        const emptyCatchPattern = /try\s*\{[^}]*\}\s*catch\s*\([^)]*\)\s*\{\s*\}/g;
        if (emptyCatchPattern.test(code)) {
          addFinding(
            "bugs",
            "warning",
            "Empty catch block",
            "Errors are silently swallowed in an empty catch block. This can hide bugs and make debugging difficult.",
            "Add error logging or rethrow the error.",
          );
        }
      }

      // ── Security checks ──
      if (categories.includes("security")) {
        // eval usage
        if (code.match(/\beval\s*\(/)) {
          addFinding(
            "security",
            "critical",
            "eval() usage detected",
            "eval() executes arbitrary code and is a major security risk. It can lead to code injection attacks.",
            "Use JSON.parse() for data, or a proper expression parser.",
          );
        }

        // innerHTML
        if (code.includes("innerHTML")) {
          addFinding(
            "security",
            "critical",
            "innerHTML assignment",
            "Setting innerHTML with user input can lead to XSS attacks. Sanitize all input before use.",
            "Use textContent or a sanitization library like DOMPurify.",
          );
        }

        // Hardcoded secrets
        const secretPatterns = [
          /(?:password|secret|key|token|api[_-]?key)\s*[:=]\s*['"`][^'"`]+['"`]/i,
          /sk-[a-zA-Z0-9]{20,}/,
          /AKIA[0-9A-Z]{16}/,
        ];
        for (const pattern of secretPatterns) {
          if (pattern.test(code)) {
            addFinding(
              "security",
              "critical",
              "Potential hardcoded secret",
              "A password, API key, or token appears to be hardcoded in the source code. This is a critical security risk.",
              "Use environment variables or a secrets manager.",
            );
            break;
          }
        }

        // SQL injection risk
        if (code.match(/["`].*(?:SELECT|INSERT|UPDATE|DELETE).*\$\{/i)) {
          addFinding(
            "security",
            "critical",
            "Possible SQL injection",
            "SQL query constructed with string interpolation. This is vulnerable to SQL injection attacks.",
            "Use parameterized queries or prepared statements.",
          );
        }

        // Command injection
        if (code.includes("exec(") && code.match(/\$\{|\+.*\b(req|input|param|body)/i)) {
          addFinding(
            "security",
            "critical",
            "Possible command injection",
            "Shell command constructed with user input. This is vulnerable to command injection attacks.",
            "Use a whitelist of allowed commands or sanitize input thoroughly.",
          );
        }

        // Insecure HTTPS
        if (code.includes("http://") && !code.includes("localhost") && !code.includes("127.0.0.1")) {
          addFinding(
            "security",
            "warning",
            "HTTP URL in production code",
            "An HTTP URL is used instead of HTTPS. Data transmitted over HTTP is not encrypted.",
            "Use HTTPS for all external API calls.",
          );
        }
      }

      // ── Performance checks ──
      if (categories.includes("performance")) {
        // Large bundle imports
        if (code.includes("import * as") || code.includes("require(")) {
          addFinding(
            "performance",
            "info",
            "Wildcard/require import",
            "Importing entire modules can increase bundle size and startup time.",
            "Use named imports to tree-shake unused exports.",
          );
        }

        // Nested loops
        const nestedLoopPattern = /for\s*\([^)]*\)\s*\{[^}]*for\s*\(/g;
        if (nestedLoopPattern.test(code)) {
          addFinding(
            "performance",
            "warning",
            "Nested loops detected",
            "Nested loops have O(n²) complexity. This can be a performance bottleneck with large datasets.",
            "Consider using a Map or Set for O(1) lookups, or algorithm optimization.",
          );
        }

        // console.log in production
        if (code.includes("console.log") && !code.includes("// dev")) {
          addFinding(
            "performance",
            "info",
            "console.log statements",
            "console.log calls can impact performance and leak information in production.",
            "Use a proper logging library with log levels.",
          );
        }

        // Synchronous operations in hot path
        if (code.includes("fs.readFileSync") || code.includes("fs.writeFileSync")) {
          addFinding(
            "performance",
            "warning",
            "Synchronous file I/O",
            "Synchronous file operations block the event loop. This can cause performance issues in high-traffic scenarios.",
            "Use async file operations (fs.promises or callbacks).",
          );
        }
      }

      // ── Style checks ──
      if (categories.includes("style")) {
        // Long lines
        const longLines = code.split("\n").filter((line) => line.length > 120);
        if (longLines.length > 3) {
          addFinding(
            "style",
            "info",
            "Multiple long lines (>120 chars)",
            `${longLines.length} lines exceed 120 characters. Long lines reduce readability.`,
            "Break long lines to improve readability.",
          );
        }

        // Magic numbers
        const magicNumbers = code.match(/\b(?:\d+\.\d+|\d{3,})\b/g);
        if (magicNumbers && magicNumbers.length > 3) {
          addFinding(
            "style",
            "info",
            "Magic numbers",
            "Multiple numeric literals found. Magic numbers make code harder to understand and maintain.",
            "Extract magic numbers into named constants.",
          );
        }

        // Deeply nested code
        const maxNesting = code.split("\n").reduce((max, line) => {
          const indent = line.match(/^(\s*)/)?.[1]?.length ?? 0;
          const nesting = indent / 2;
          return Math.max(max, nesting);
        }, 0);
        if (maxNesting > 4) {
          addFinding(
            "style",
            "warning",
            "Deep nesting level",
            `Code nesting depth of ${Math.round(maxNesting)} found. Deep nesting reduces readability.`,
            "Use early returns, guard clauses, or extract functions to reduce nesting.",
          );
        }

        // Missing JSDoc for public functions
        const publicFuncCount = (code.match(/export\s+(?:async\s+)?function\s+\w+/g) || []).length;
        const jsdocCount = (code.match(/\/\*\*[\s\S]*?\*\//g) || []).length;
        if (publicFuncCount > 0 && jsdocCount < publicFuncCount) {
          addFinding(
            "style",
            "info",
            "Missing JSDoc comments",
            `${publicFuncCount} exported functions found but only ${jsdocCount} JSDoc blocks.`,
            "Add JSDoc comments to exported functions for better documentation.",
          );
        }
      }

      // ── Architecture checks ──
      if (categories.includes("architecture")) {
        // Large file
        const lineCount = code.split("\n").length;
        if (lineCount > 300) {
          addFinding(
            "architecture",
            "warning",
            "Large file",
            `File has ${lineCount} lines. Large files are harder to maintain and test.`,
            "Consider splitting into smaller, focused modules.",
          );
        }

        // God class/object
        const methodCount = (code.match(/(?:^|\s)(?:async\s+)?\w+\s*\([^)]*\)\s*\{/gm) || []).length;
        if (methodCount > 15) {
          addFinding(
            "architecture",
            "warning",
            "God class/object",
            `Class/object has ${methodCount} methods. This suggests the class is doing too much.`,
            "Apply the Single Responsibility Principle and split into smaller classes.",
          );
        }

        // Circular dependency risk
        if (code.includes("import") && code.includes("export")) {
          const imports = code.match(/import\s+.*from\s+['"]([^'"]+)['"]/g) || [];
          if (imports.length > 10) {
            addFinding(
              "architecture",
              "info",
              "High import count",
              `${imports.length} imports found. High import counts can indicate tight coupling or circular dependencies.`,
              "Review dependencies and consider barrel exports or module consolidation.",
            );
          }
        }

        // Missing error boundaries
        if (code.includes("React") || code.includes("react")) {
          if (!code.includes("ErrorBoundary") && !code.includes("errorBoundary") && code.includes("try") === false) {
            addFinding(
              "architecture",
              "warning",
              "No error boundaries",
              "React component tree without error boundaries. Unhandled errors will crash the entire app.",
              "Add ErrorBoundary components to catch and handle rendering errors.",
            );
          }
        }
      }

      // ── Focus-specific checks ──
      if (params.focus) {
        const focusLower = params.focus.toLowerCase();
        if (focusLower.includes("security")) {
          // Additional security checks
          if (code.includes("JSON.parse") && code.includes("req.body")) {
            addFinding(
              "security",
              "warning",
              "Unvalidated JSON.parse of user input",
              "Parsing user-supplied JSON without validation can lead to DoS or unexpected behavior.",
              "Validate and sanitize parsed JSON data.",
            );
          }
        }
      }

      // Build result
      const filtered = filterFindings(findings, config);
      const score = calculateScore(filtered);
      const severityCounts = countBySeverity(filtered);

      const summary = filtered.length > 0
        ? `Found ${filtered.length} issues: ${severityCounts.critical} critical, ${severityCounts.warning} warnings, ${severityCounts.info} info. Score: ${score}/100.`
        : "No issues found. Score: 100/100.";

      const result: ReviewResult = {
        findings: filtered,
        summary,
        score,
        timestamp: Date.now(),
      };

      saveReview(result);
      renderWidget(ctx);

      // Update status
      const statusColor = score >= 80 ? "success" : score >= 50 ? "warning" : "error";
      ctx.ui.setStatus("code-review", ctx.ui.theme.fg(statusColor as any, `📋 ${score}/100`));

      return {
        content: [
          {
            type: "text",
            text: `## Code Review Results\n\n${summary}\n\n### Findings\n\n${filtered
              .map(
                (f) =>
                  `#### ${f.severity === "critical" ? "🔴" : f.severity === "warning" ? "🟡" : "⚪"} [${CATEGORY_LABELS[f.category]}] ${f.title}\n\n${f.description}\n${f.suggestion ? `**Suggestion:** ${f.suggestion}` : ""}${f.location ? `\n**Location:** ${f.location}` : ""}`,
              )
              .join("\n\n")}`,
          },
        ],
        details: result,
      };
    },
  });

  // ── Commands ─────────────────────────────────────────────────────────────

  pi.registerCommand("review", {
    description: "Review code (staged, unstaged, file, diff, commit, or last commit)",
    getArgumentCompletions: (prefix: string) => {
      const options = [
        { value: "--staged", label: "--staged", description: "Review staged git changes" },
        { value: "--unstaged", label: "--unstaged", description: "Review unstaged changes" },
        { value: "--file", label: "--file", description: "Review a specific file" },
        { value: "--diff", label: "--diff", description: "Review diff between refs" },
        { value: "--commit", label: "--commit", description: "Review a specific commit" },
        { value: "--last-commit", label: "--last-commit", description: "Review the last commit" },
      ];
      const filtered = options.filter((o) => o.value.startsWith(prefix));
      return filtered.length > 0 ? filtered : null;
    },
    handler: async (args, ctx) => {
      const trimmed = args?.trim();
      if (!trimmed) {
        // Default: review staged changes
        await runReview(ctx, "staged");
      } else if (trimmed === "--staged") {
        await runReview(ctx, "staged");
      } else if (trimmed === "--unstaged") {
        await runReview(ctx, "unstaged");
      } else if (trimmed.startsWith("--file ")) {
        const file = trimmed.slice("--file ".length).trim();
        await runReview(ctx, "file", file);
      } else if (trimmed.startsWith("--diff ")) {
        const refRange = trimmed.slice("--diff ".length).trim();
        await runReview(ctx, "diff", refRange);
      } else if (trimmed.startsWith("--commit ")) {
        const commitRef = trimmed.slice("--commit ".length).trim();
        await runReview(ctx, "commit", commitRef);
      } else if (trimmed === "--last-commit") {
        await runReview(ctx, "commit", "HEAD");
      } else {
        ctx.ui.notify(`Unknown review option: ${trimmed}. Use: --staged, --unstaged, --file <path>, --diff <ref1..ref2>, --commit <sha>, --last-commit`, "warning");
      }
    },
  });

  pi.registerCommand("review:clear", {
    description: "Clear the code review widget",
    handler: async (_args, ctx) => {
      lastReview = undefined;
      clearWidget(ctx);
      ctx.ui.notify("Review widget cleared.", "info");
    },
  });

  pi.registerCommand("review:config", {
    description: "Configure code review categories",
    handler: async (_args, ctx) => {
      const items = [
        { id: "bugs", label: "Bugs", currentValue: config.categories.includes("bugs") ? "on" : "off", values: ["on", "off"] },
        { id: "security", label: "Security", currentValue: config.categories.includes("security") ? "on" : "off", values: ["on", "off"] },
        { id: "performance", label: "Performance", currentValue: config.categories.includes("performance") ? "on" : "off", values: ["on", "off"] },
        { id: "style", label: "Style", currentValue: config.categories.includes("style") ? "on" : "off", values: ["on", "off"] },
        { id: "architecture", label: "Architecture", currentValue: config.categories.includes("architecture") ? "on" : "off", values: ["on", "off"] },
        { id: "maxFindings", label: "Max findings", currentValue: String(config.maxFindings), values: ["10", "25", "50", "100"] },
        { id: "minSeverity", label: "Min severity", currentValue: config.minSeverity, values: ["info", "warning", "critical"] },
      ];

      const { Container, SettingsList, Text } = await import("@earendil-works/pi-tui");
      const { getSettingsListTheme } = await import("@earendil-works/pi-coding-agent");

      await ctx.ui.custom((_tui, theme, _kb, done) => {
        const container = new Container();
        container.addChild(new Text(theme.fg("accent", theme.bold("Code Review Config")), 1, 1));

        const settingsList = new SettingsList(
          items,
          Math.min(items.length + 2, 15),
          getSettingsListTheme(),
          (id, newValue) => {
            if (id === "maxFindings") {
              config.maxFindings = parseInt(newValue, 10);
            } else if (id === "minSeverity") {
              config.minSeverity = newValue as Severity;
            } else {
              const cat = id as ReviewCategory;
              if (newValue === "on" && !config.categories.includes(cat)) {
                config.categories.push(cat);
              } else if (newValue === "off") {
                config.categories = config.categories.filter((c) => c !== cat);
              }
            }
            saveConfig();
            ctx.ui.notify(`${id} = ${newValue}`, "info");
          },
          () => done(undefined),
          { enableSearch: false },
        );
        container.addChild(settingsList);

        return {
          render: (w) => container.render(w),
          invalidate: () => container.invalidate(),
          handleInput: (data) => settingsList.handleInput?.(data),
        };
      });
    },
  });

  // ── Review execution ────────────────────────────────────────────────────

  async function runReview(
    ctx: ExtensionContext,
    mode: "staged" | "unstaged" | "file" | "diff" | "commit",
    target?: string,
  ): Promise<void> {
    let code = "";
    let description = "";

    try {
      if (mode === "staged") {
        const { stdout } = await execGit("diff --cached", ctx);
        if (!stdout.trim()) {
          ctx.ui.notify("No staged changes to review.", "info");
          return;
        }
        code = stdout;
        description = "staged changes";
      } else if (mode === "unstaged") {
        const { stdout } = await execGit("diff", ctx);
        if (!stdout.trim()) {
          ctx.ui.notify("No unstaged changes to review.", "info");
          return;
        }
        code = stdout;
        description = "unstaged changes";
      } else if (mode === "file") {
        if (!target) return;
        code = await readFile(target, ctx);
        description = `file ${target}`;
      } else if (mode === "diff") {
        if (!target) return;
        if (!isSafeGitRef(target)) {
          ctx.ui.notify(`Invalid git ref: ${target}`, "error");
          return;
        }
        const { stdout } = await execGit(`diff ${target}`, ctx);
        if (!stdout.trim()) {
          ctx.ui.notify(`No diff found for ${target}.`, "info");
          return;
        }
        code = stdout;
        description = `diff ${target}`;
      } else if (mode === "commit") {
        if (!target) return;
        if (!isSafeGitRef(target)) {
          ctx.ui.notify(`Invalid git ref: ${target}`, "error");
          return;
        }
        const { stdout } = await execGit(`show --format="" --patch ${target}`, ctx);
        if (!stdout.trim()) {
          ctx.ui.notify(`No changes found in commit ${target}.`, "info");
          return;
        }
        code = stdout;
        description = `commit ${target}`;
      }
    } catch (err: any) {
      ctx.ui.notify(`Failed to get code: ${err.message}`, "error");
      return;
    }

    ctx.ui.notify(`Reviewing ${description}...`, "info");

    // Send review request to the agent
    const reviewPrompt = `Please review the following code using the code_review tool:

\`\`\`
${code}
\`\`\`

Categories to check: ${config.categories.join(", ")}
${config.minSeverity !== "info" ? `Minimum severity: ${config.minSeverity}` : ""}`;

    pi.sendUserMessage(reviewPrompt, { deliverAs: "followUp" });
  }

  // ── Git helpers ─────────────────────────────────────────────────────────

  function isSafeGitRef(ref: string): boolean {
    // Allow alphanumeric, dots, slashes, hyphens, underscores, tildes, carets, at-signs
    return /^[a-zA-Z0-9._/~^@-]+$/.test(ref);
  }

  async function execGit(command: string, ctx: ExtensionContext): Promise<{ stdout: string; stderr: string }> {
    const { execSync } = await import("node:child_process");
    try {
      const stdout = execSync(`git ${command}`, {
        cwd: ctx.cwd,
        encoding: "utf-8",
        maxBuffer: 5 * 1024 * 1024, // 5MB
      });
      return { stdout, stderr: "" };
    } catch (err: any) {
      throw new Error(err.stderr?.toString().trim() || err.message);
    }
  }

  async function readFile(path: string, ctx: ExtensionContext): Promise<string> {
    const { readFileSync } = await import("node:fs");
    const { resolve, isAbsolute } = await import("node:path");
    const fullPath = isAbsolute(path) ? path : resolve(ctx.cwd, path);
    return readFileSync(fullPath, "utf-8");
  }

  // ── before_agent_start hook ─────────────────────────────────────────────

  pi.on("before_agent_start", async (event, ctx) => {
    // Clear the review widget when a new agent turn starts
    clearWidget(ctx);

    // Inject review context when reviewing code
    if (event.prompt.toLowerCase().includes("review") || event.prompt.includes("code_review")) {
      return {
        message: {
          customType: "code-review-context",
          content: `[CODE REVIEW MODE]
You are performing a code review. Use the code_review tool to analyze the code.

Review categories enabled: ${config.categories.join(", ")}
Minimum severity: ${config.minSeverity}

After the review, provide a summary with:
1. Overall score and severity breakdown
2. Key findings organized by category
3. Actionable suggestions for each finding
4. Prioritized list of what to fix first`,
          display: false,
        },
      };
    }
  });

  // ── Session lifecycle ───────────────────────────────────────────────────

  pi.on("session_start", async (_event, ctx) => {
    loadConfig(ctx);

    // Restore last review
    const entries = ctx.sessionManager.getEntries();
    const lastReviewEntry = [...entries].reverse().find(
      (e: any) => e.type === "custom" && e.customType === "code-review-result",
    ) as any | undefined;
    if (lastReviewEntry?.data) {
      lastReview = lastReviewEntry.data;
      renderWidget(ctx);
    }
  });

  pi.on("session_shutdown", async (_event, ctx) => {
    clearWidget(ctx);
  });
}

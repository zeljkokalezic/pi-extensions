/**
 * Utility types and functions for code review extension.
 */

export type Severity = "critical" | "warning" | "info";
export type ReviewCategory = "bugs" | "security" | "performance" | "style" | "architecture";

export interface ReviewFinding {
  id: string;
  category: ReviewCategory;
  severity: Severity;
  title: string;
  description: string;
  location?: string;
  suggestion?: string;
}

export interface ReviewResult {
  findings: ReviewFinding[];
  summary: string;
  score: number; // 0-100, higher is better
  timestamp: number;
}

export interface ReviewConfig {
  categories: ReviewCategory[];
  maxFindings: number;
  minSeverity: Severity;
  autoReviewStaged: boolean;
}

export const DEFAULT_CONFIG: ReviewConfig = {
  categories: ["bugs", "security", "performance", "style", "architecture"],
  maxFindings: 50,
  minSeverity: "info",
  autoReviewStaged: false,
};

export const SEVERITY_ORDER: Record<Severity, number> = {
  critical: 3,
  warning: 2,
  info: 1,
};

export const CATEGORY_LABELS: Record<ReviewCategory, string> = {
  bugs: "Bugs",
  security: "Security",
  performance: "Performance",
  style: "Style",
  architecture: "Architecture",
};

export function filterFindings(
  findings: ReviewFinding[],
  config: ReviewConfig,
): ReviewFinding[] {
  return findings
    .filter((f) => config.categories.includes(f.category))
    .filter((f) => SEVERITY_ORDER[f.severity] >= SEVERITY_ORDER[config.minSeverity])
    .slice(0, config.maxFindings);
}

export function calculateScore(findings: ReviewFinding[]): number {
  if (findings.length === 0) return 100;

  const penalty = findings.reduce((acc, f) => {
    return acc + (f.severity === "critical" ? 20 : f.severity === "warning" ? 10 : 3);
  }, 0);

  return Math.max(0, Math.min(100, 100 - penalty));
}

export function countBySeverity(findings: ReviewFinding[]): Record<Severity, number> {
  return {
    critical: findings.filter((f) => f.severity === "critical").length,
    warning: findings.filter((f) => f.severity === "warning").length,
    info: findings.filter((f) => f.severity === "info").length,
  };
}

export function countByCategory(findings: ReviewFinding[]): Record<ReviewCategory, number> {
  const counts: Record<string, number> = {};
  for (const cat of Object.keys(CATEGORY_LABELS)) {
    counts[cat] = findings.filter((f) => f.category === cat).length;
  }
  return counts as Record<ReviewCategory, number>;
}

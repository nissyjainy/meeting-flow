import type { OwnerInsightHighlight } from "@/lib/analytics/accountability-analytics";
import type { HealthScoreResult } from "./execution-health-score";

export type ExecutiveSummaryInput = {
  health: HealthScoreResult;
  completionRate: number;
  overduePercent: number;
  atRiskCount: number;
  bestPerformer: OwnerInsightHighlight | null;
};

export function buildExecutiveSummary(input: ExecutiveSummaryInput): string {
  const { health, completionRate, overduePercent, atRiskCount, bestPerformer } = input;
  const lines: string[] = [
    `Execution Health is ${health.score}/100 (${health.label}).`,
    `Completion rate is ${completionRate}%.`,
  ];

  if (overduePercent <= 15) {
    lines.push("Overdue workload remains low.");
  } else if (overduePercent <= 30) {
    lines.push("Overdue workload is moderate and should be monitored.");
  } else {
    lines.push("Overdue workload is elevated and needs attention.");
  }

  if (bestPerformer) {
    lines.push(`${bestPerformer.ownerLabel} is currently the strongest performer.`);
  } else {
    lines.push("No clear top performer yet — assign and complete tasks to unlock owner insights.");
  }

  if (atRiskCount === 0) {
    lines.push("No tasks are at risk in the next three days.");
  } else if (atRiskCount === 1) {
    lines.push("1 task is at risk this week.");
  } else {
    lines.push(`${atRiskCount} tasks are at risk this week.`);
  }

  return lines.join("\n\n");
}

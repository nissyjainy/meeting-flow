import type { ExecutionHealthBundle } from "@/lib/execution-health/execution-health";
import type { CopilotAdvancedInsights } from "./copilot-advanced-insights";
import type { CopilotWorkspaceContext } from "./types";

export const ADVANCED_INSIGHTS_UNAVAILABLE_MESSAGE =
  "Advanced insights are not available yet.";

function guardAdvancedInsights(
  workspace: CopilotWorkspaceContext,
): CopilotAdvancedInsights | null {
  return workspace.advancedInsights ?? null;
}

function guardExecutionHealth(
  workspace: CopilotWorkspaceContext,
): ExecutionHealthBundle | null {
  return workspace.executionHealth ?? null;
}

function formatDeadline(deadline: string | null): string {
  if (!deadline?.trim()) return "No deadline";
  const trimmed = deadline.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    }
  }
  return trimmed;
}

export function formatOwnerImprovement(workspace: CopilotWorkspaceContext): string {
  const insights = guardAdvancedInsights(workspace);
  if (!insights) return ADVANCED_INSIGHTS_UNAVAILABLE_MESSAGE;

  const winner = insights.ownerImprovement;
  if (!winner) {
    return "No owner improvement trends yet — complete tasks across months to compare progress.";
  }

  return [
    "Owner improvement this month:",
    `• ${winner.ownerLabel} improved the most: ${winner.reason}`,
  ].join("\n");
}

export function formatOwnerDecline(workspace: CopilotWorkspaceContext): string {
  const insights = guardAdvancedInsights(workspace);
  if (!insights) return ADVANCED_INSIGHTS_UNAVAILABLE_MESSAGE;

  const decline = insights.ownerDecline;
  if (!decline) {
    return "No owner decline trends detected this month.";
  }

  return [
    "Owner decline this month:",
    `• ${decline.ownerLabel} declined the most: ${decline.reason}`,
  ].join("\n");
}

export function formatExecutionBottlenecks(workspace: CopilotWorkspaceContext): string {
  const insights = guardAdvancedInsights(workspace);
  if (!insights) return ADVANCED_INSIGHTS_UNAVAILABLE_MESSAGE;

  if (insights.executionBottlenecks.length === 0) {
    return "No major execution bottlenecks detected — team execution looks healthy.";
  }

  const lines = insights.executionBottlenecks.map(
    (item) => `• ${item.signal}: ${item.detail}`,
  );

  return ["Execution bottlenecks:", "", ...lines].join("\n");
}

export function formatMeetingsMostTasks(workspace: CopilotWorkspaceContext): string {
  const insights = guardAdvancedInsights(workspace);
  if (!insights) return ADVANCED_INSIGHTS_UNAVAILABLE_MESSAGE;

  if (insights.meetingsMostTasks.length === 0) {
    return "No meetings with extracted action items yet.";
  }

  const lines = insights.meetingsMostTasks.map(
    (meeting) =>
      `• ${meeting.meetingTitle}: ${meeting.taskCount} action item${meeting.taskCount === 1 ? "" : "s"}`,
  );

  return ["Meetings generating the most action items:", "", ...lines].join("\n");
}

export function formatAtRiskOwners(workspace: CopilotWorkspaceContext): string {
  const insights = guardAdvancedInsights(workspace);
  if (!insights) return ADVANCED_INSIGHTS_UNAVAILABLE_MESSAGE;

  if (insights.atRiskOwners.length === 0) {
    return "No owners currently flagged for attention.";
  }

  const lines = insights.atRiskOwners.map((owner) => {
    const reasons =
      owner.reasons.length > 0 ? ` (${owner.reasons.join(", ")})` : "";
    return `• ${owner.ownerLabel} — attention score ${owner.attentionScore}${reasons}`;
  });

  return ["Owners needing attention:", "", ...lines].join("\n");
}

export function formatAtRiskTasks(workspace: CopilotWorkspaceContext): string {
  const insights = guardAdvancedInsights(workspace);
  if (!insights) return ADVANCED_INSIGHTS_UNAVAILABLE_MESSAGE;

  if (insights.atRiskTasks.length === 0) {
    return "No tasks are currently at risk (overdue or due within 3 days).";
  }

  const lines = insights.atRiskTasks.map((row) => {
    const status = row.isOverdue ? "Overdue" : "Due soon";
    const owner = row.owner?.trim() || "Unassigned";
    return `• ${row.task} · ${owner} · ${formatDeadline(row.deadline)} · ${status}`;
  });

  return ["Tasks most at risk:", "", ...lines].join("\n");
}

export function formatWeeklyFocus(workspace: CopilotWorkspaceContext): string {
  const insights = guardAdvancedInsights(workspace);
  if (!insights) return ADVANCED_INSIGHTS_UNAVAILABLE_MESSAGE;

  const lines = insights.weeklyFocus.map((bullet) => `• ${bullet.text}`);

  return ["Focus this week:", "", ...lines].join("\n");
}

export function formatWorkloadImbalance(workspace: CopilotWorkspaceContext): string {
  const insights = guardAdvancedInsights(workspace);
  if (!insights) return ADVANCED_INSIGHTS_UNAVAILABLE_MESSAGE;

  const { workloadImbalance } = insights;

  if (!workloadImbalance.imbalanceDetected) {
    return [
      "Workload balance:",
      `• Workload is balanced across owners (mean ${workloadImbalance.meanAssigned} tasks per owner).`,
    ].join("\n");
  }

  const overloadedLines = workloadImbalance.overloaded.map(
    (owner) => `• ${owner.ownerLabel}: ${owner.assigned} assigned (above mean)`,
  );
  const underloadedLines = workloadImbalance.underloaded.map(
    (owner) => `• ${owner.ownerLabel}: ${owner.assigned} assigned (below mean)`,
  );

  return [
    "Workload imbalance detected:",
    `• Imbalance ratio: ${workloadImbalance.imbalanceRatio}x (mean ${workloadImbalance.meanAssigned} tasks per owner)`,
    "",
    "Overloaded:",
    ...(overloadedLines.length > 0 ? overloadedLines : ["• None"]),
    "",
    "Underloaded:",
    ...(underloadedLines.length > 0 ? underloadedLines : ["• None"]),
  ].join("\n");
}

export function formatExecutiveBriefing(workspace: CopilotWorkspaceContext): string {
  const bundle = guardExecutionHealth(workspace);
  const insights = guardAdvancedInsights(workspace);
  if (!bundle || !insights) return ADVANCED_INSIGHTS_UNAVAILABLE_MESSAGE;

  const { overview, health, executiveSummary } = bundle;
  const focusLines = insights.weeklyFocus.slice(0, 3).map((bullet) => `• ${bullet.text}`);

  return [
    "Executive briefing:",
    "",
    executiveSummary,
    "",
    "Health score:",
    `• ${overview.healthScore}/100 (${overview.healthLabel})`,
    `• Completion rate: ${overview.completionRate}% · On-time: ${overview.onTimeCompletionRate}%`,
    `• Open tasks: ${overview.openTasks} · Overdue: ${bundle.execution.overdue} · At risk (≤3 days): ${bundle.atRiskCount}`,
    "",
    ...(health.risks.length > 0
      ? ["Key risks:", ...health.risks.map((risk) => `• ${risk}`), ""]
      : []),
    ...(health.strengths.length > 0
      ? ["Strengths:", ...health.strengths.map((strength) => `• ${strength}`), ""]
      : []),
    "Recommended focus:",
    ...(focusLines.length > 0 ? focusLines : ["• Continue steady execution on open tasks"]),
  ].join("\n");
}

export function formatAdvancedCopilotResponse(
  intent:
    | "owner_improvement"
    | "owner_decline"
    | "execution_bottlenecks"
    | "meetings_most_tasks"
    | "at_risk_owners"
    | "at_risk_tasks"
    | "weekly_focus"
    | "workload_imbalance"
    | "executive_briefing",
  workspace: CopilotWorkspaceContext,
): string {
  switch (intent) {
    case "owner_improvement":
      return formatOwnerImprovement(workspace);
    case "owner_decline":
      return formatOwnerDecline(workspace);
    case "execution_bottlenecks":
      return formatExecutionBottlenecks(workspace);
    case "meetings_most_tasks":
      return formatMeetingsMostTasks(workspace);
    case "at_risk_owners":
      return formatAtRiskOwners(workspace);
    case "at_risk_tasks":
      return formatAtRiskTasks(workspace);
    case "weekly_focus":
      return formatWeeklyFocus(workspace);
    case "workload_imbalance":
      return formatWorkloadImbalance(workspace);
    case "executive_briefing":
      return formatExecutiveBriefing(workspace);
  }
}

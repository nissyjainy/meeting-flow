import type { SupabaseClient } from "@supabase/supabase-js";
import { loadCopilotWorkspaceContext } from "@/lib/copilot/copilot-data.server";
import { formatAdvancedCopilotResponse } from "@/lib/copilot/format-advanced-insights";
import {
  formatCopilotMeetingResponse,
  formatCopilotWorkspaceResponse,
} from "@/lib/copilot/format-response";
import type { CopilotMeetingContext, CopilotWorkspaceContext } from "@/lib/copilot/types";
import { assistantLog } from "./assistant-debug";

/** Reuses Copilot workspace loader — same analytics bundles as the legacy panel. */
export async function loadAssistantWorkspaceAnalytics(
  supabase: SupabaseClient,
): Promise<CopilotWorkspaceContext> {
  return loadCopilotWorkspaceContext(supabase);
}

function buildWorkspaceReminderContext(
  workspace: CopilotWorkspaceContext,
): CopilotMeetingContext {
  return {
    meetingId: null,
    meetingTitle: "Your workspace",
    summary: null,
    pipelineStatus: "none",
    tasks: workspace.tasks,
    remindersSent: workspace.remindersSent,
  };
}

/**
 * Serializes pre-computed Copilot analytics into the Assistant LLM context.
 * Uses existing formatters — no duplicated analytics logic.
 */
export function buildAssistantAnalyticsContext(workspace: CopilotWorkspaceContext): string {
  const sections: Array<{ title: string; body: string }> = [
    {
      title: "REMINDER STATUS",
      body: formatCopilotMeetingResponse(
        "reminder_status",
        buildWorkspaceReminderContext(workspace),
      ),
    },
    {
      title: "OVERDUE TASKS",
      body: formatCopilotWorkspaceResponse("overdue_tasks", workspace),
    },
    {
      title: "AT-RISK TASKS",
      body: formatAdvancedCopilotResponse("at_risk_tasks", workspace),
    },
    {
      title: "WEEKLY FOCUS",
      body: formatAdvancedCopilotResponse("weekly_focus", workspace),
    },
    {
      title: "EXECUTIVE BRIEFING",
      body: formatAdvancedCopilotResponse("executive_briefing", workspace),
    },
    {
      title: "EXECUTION HEALTH",
      body: formatCopilotWorkspaceResponse("execution_health", workspace),
    },
    {
      title: "BEST PERFORMER",
      body: formatCopilotWorkspaceResponse("best_performer", workspace),
    },
  ];

  const body = sections
    .map((section) => `--- ${section.title} ---\n${section.body}`)
    .join("\n\n");

  assistantLog("analytics context built", {
    sectionCount: sections.length,
    length: body.length,
    remindersSent: workspace.remindersSent,
    taskCount: workspace.tasks.length,
    healthScore: workspace.executionHealth?.overview.healthScore ?? null,
  });

  return body;
}

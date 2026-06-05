import { describe, expect, it } from "vitest";
import { computeAccountabilityAnalytics } from "@/lib/analytics/accountability-analytics";
import { computeExecutionHealthBundle } from "@/lib/execution-health/execution-health";
import { computeCopilotAdvancedInsights } from "@/lib/copilot/copilot-advanced-insights";
import type { CopilotWorkspaceContext } from "@/lib/copilot/types";
import type { MeetingTaskRecord } from "@/lib/meetings/types";
import { buildAssistantAnalyticsContext } from "./assistant-analytics-context.server";

const referenceDate = new Date("2026-05-28T12:00:00.000Z");

const fixtureTasks: MeetingTaskRecord[] = [
  {
    id: "task-1",
    meeting_id: "meeting-a",
    task: "Ship dashboard",
    owner: "Nisarg",
    deadline: "2026-05-10",
    status: "pending",
    created_at: "2026-05-20T10:05:00.000Z",
    updated_at: "2026-05-20T10:05:00.000Z",
    started_at: null,
    completed_at: null,
  },
  {
    id: "task-2",
    meeting_id: "meeting-a",
    task: "Write docs",
    owner: "Rahul",
    deadline: "2026-06-01",
    status: "completed",
    created_at: "2026-05-20T10:06:00.000Z",
    updated_at: "2026-05-27T10:06:00.000Z",
    started_at: "2026-05-25T10:06:00.000Z",
    completed_at: "2026-05-27T10:06:00.000Z",
  },
];

function buildFixtureWorkspace(): CopilotWorkspaceContext {
  const accountability = computeAccountabilityAnalytics(fixtureTasks, [], referenceDate);
  const executionHealth = computeExecutionHealthBundle(fixtureTasks, [], referenceDate);
  const advancedInsights = computeCopilotAdvancedInsights({
    bundle: executionHealth,
    meetings: [
      {
        meetingId: "meeting-a",
        meetingTitle: "standup",
        summary: "Summary",
        pipelineStatus: "ready",
        createdAt: "2026-05-20T10:00:00.000Z",
        taskCount: 2,
      },
    ],
    tasks: fixtureTasks,
    referenceDate,
  });

  return {
    meetings: [
      {
        meetingId: "meeting-a",
        meetingTitle: "standup",
        summary: "Summary",
        pipelineStatus: "ready",
        createdAt: "2026-05-20T10:00:00.000Z",
        taskCount: 2,
      },
    ],
    tasks: [
      {
        id: "task-1",
        meetingId: "meeting-a",
        meetingTitle: "standup",
        task: "Ship dashboard",
        owner: "Nisarg",
        ownerEmail: "nisarg@example.com",
        deadline: "2026-05-10",
        storedStatus: "pending",
        status: "overdue",
        reminderCategory: "overdue",
      },
      {
        id: "task-2",
        meetingId: "meeting-a",
        meetingTitle: "standup",
        task: "Write docs",
        owner: "Rahul",
        ownerEmail: "rahul@example.com",
        deadline: "2026-06-01",
        storedStatus: "completed",
        status: "completed",
        reminderCategory: null,
      },
    ],
    execution: executionHealth.execution,
    taskStats: {
      pendingTasks: 1,
      overdueTasks: 1,
      completedTasks: 1,
    },
    accountability,
    executionHealth,
    advancedInsights,
    topPriorities: executionHealth.topPriorities,
    remindersSent: 2,
    reminderHistory: [],
  };
}

describe("buildAssistantAnalyticsContext", () => {
  it("includes all migrated Copilot analytics sections", () => {
    const context = buildAssistantAnalyticsContext(buildFixtureWorkspace());

    expect(context).toContain("--- REMINDER STATUS ---");
    expect(context).toContain("--- OVERDUE TASKS ---");
    expect(context).toContain("--- AT-RISK TASKS ---");
    expect(context).toContain("--- WEEKLY FOCUS ---");
    expect(context).toContain("--- EXECUTIVE BRIEFING ---");
    expect(context).toContain("--- EXECUTION HEALTH ---");
    expect(context).toContain("--- BEST PERFORMER ---");
  });

  it("surfaces overdue and executive briefing content from shared formatters", () => {
    const context = buildAssistantAnalyticsContext(buildFixtureWorkspace());

    expect(context).toContain("overdue task");
    expect(context).toContain("Executive briefing:");
    expect(context).toContain("Focus this week:");
  });
});

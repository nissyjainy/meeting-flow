import { describe, expect, it } from "vitest";
import { computeAccountabilityAnalytics } from "@/lib/analytics/accountability-analytics";
import { computeExecutionHealthBundle } from "@/lib/execution-health/execution-health";
import { computeCopilotAdvancedInsights } from "./copilot-advanced-insights";
import { formatCopilotWorkspaceResponse } from "./format-response";
import type { CopilotWorkspaceContext } from "./types";
import type { MeetingTaskRecord } from "@/lib/meetings/types";

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

const workspace: CopilotWorkspaceContext = {
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
      ownerEmail: null,
      deadline: "2026-06-01",
      storedStatus: "completed",
      status: "completed",
      reminderCategory: null,
    },
  ],
  execution: {
    totalOpen: 1,
    overdue: 1,
    dueToday: 0,
    completedThisWeek: 1,
  },
  taskStats: {
    pendingTasks: 0,
    overdueTasks: 1,
    completedTasks: 1,
  },
  accountability,
  executionHealth,
  advancedInsights,
  topPriorities: executionHealth.topPriorities,
  remindersSent: 2,
  reminderHistory: [
    {
      id: "send-1",
      meetingId: "meeting-a",
      meetingTitle: "standup",
      recipient: "nisarg@example.com",
      subject: "Task reminders",
      sentAt: "2026-05-27T09:00:00.000Z",
    },
  ],
};

describe("formatCopilotWorkspaceResponse", () => {
  it("formats pending tasks excluding completed", () => {
    const answer = formatCopilotWorkspaceResponse("pending_tasks", workspace);
    expect(answer).toContain("1 pending task");
    expect(answer).toContain("Ship dashboard");
    expect(answer).not.toContain("Write docs");
  });

  it("formats overdue tasks only", () => {
    const answer = formatCopilotWorkspaceResponse("overdue_tasks", workspace);
    expect(answer).toContain("1 overdue task");
    expect(answer).toContain("Ship dashboard");
  });

  it("formats completion stats from dashboard metrics", () => {
    const answer = formatCopilotWorkspaceResponse("completion_stats", workspace);
    expect(answer).toContain("Accountability KPIs:");
    expect(answer).toContain("Open tasks: 1");
    expect(answer).toContain("Completed this week: 1");
    expect(answer).toContain("Completed (all time): 1");
    expect(answer).toContain("Reminder emails sent: 2");
  });

  it("formats reminder history entries", () => {
    const answer = formatCopilotWorkspaceResponse("reminder_history", workspace);
    expect(answer).toContain("Reminder history (1 recent)");
    expect(answer).toContain("nisarg@example.com");
    expect(answer).toContain("standup");
  });

  it("scopes pending tasks to a meeting when meetingId is provided", () => {
    const answer = formatCopilotWorkspaceResponse("pending_tasks", workspace, "meeting-a");
    expect(answer).toContain("standup");
  });
});

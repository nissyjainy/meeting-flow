import { describe, expect, it } from "vitest";
import { computeExecutionHealthBundle } from "@/lib/execution-health/execution-health";
import type { MeetingTaskRecord } from "@/lib/meetings/types";
import { computeCopilotAdvancedInsights } from "./copilot-advanced-insights";
import type { CopilotMeetingSummary } from "./types";

const referenceDate = new Date("2026-05-28T12:00:00.000Z");

const meetings: CopilotMeetingSummary[] = [
  {
    meetingId: "meeting-a",
    meetingTitle: "standup",
    summary: "Launch sync",
    pipelineStatus: "ready",
    createdAt: "2026-05-20T10:00:00.000Z",
    taskCount: 5,
  },
  {
    meetingId: "meeting-b",
    meetingTitle: "planning",
    summary: null,
    pipelineStatus: "processing",
    createdAt: "2026-05-21T10:00:00.000Z",
    taskCount: 1,
  },
];

const tasks: MeetingTaskRecord[] = [
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
    task: "Write release notes",
    owner: "Rahul",
    deadline: "2026-05-28",
    status: "completed",
    created_at: "2026-05-20T10:06:00.000Z",
    updated_at: "2026-05-27T10:06:00.000Z",
    started_at: "2026-05-25T10:06:00.000Z",
    completed_at: "2026-05-27T10:06:00.000Z",
  },
  {
    id: "task-3",
    meeting_id: "meeting-a",
    task: "Review launch checklist",
    owner: "Rahul",
    deadline: "2026-05-30",
    status: "in_progress",
    created_at: "2026-05-26T10:06:00.000Z",
    updated_at: "2026-05-26T10:06:00.000Z",
    started_at: "2026-05-26T10:06:00.000Z",
    completed_at: null,
  },
  {
    id: "task-4",
    meeting_id: "meeting-a",
    task: "Update docs",
    owner: "Rahul",
    deadline: "2026-05-15",
    status: "completed",
    created_at: "2026-04-10T10:06:00.000Z",
    updated_at: "2026-04-20T10:06:00.000Z",
    started_at: "2026-04-15T10:06:00.000Z",
    completed_at: "2026-04-20T10:06:00.000Z",
  },
  {
    id: "task-5",
    meeting_id: "meeting-a",
    task: "QA sign-off",
    owner: "Rahul",
    deadline: "2026-05-29",
    status: "completed",
    created_at: "2026-05-10T10:06:00.000Z",
    updated_at: "2026-05-26T10:06:00.000Z",
    started_at: "2026-05-20T10:06:00.000Z",
    completed_at: "2026-05-26T10:06:00.000Z",
  },
  {
    id: "task-6",
    meeting_id: "meeting-b",
    task: "Draft roadmap",
    owner: "Priya",
    deadline: "2026-05-29",
    status: "pending",
    created_at: "2026-05-21T10:06:00.000Z",
    updated_at: "2026-05-21T10:06:00.000Z",
    started_at: null,
    completed_at: null,
  },
];

function buildInsights() {
  const bundle = computeExecutionHealthBundle(tasks, [], referenceDate);
  return computeCopilotAdvancedInsights({
    bundle,
    meetings,
    tasks,
    referenceDate,
  });
}

describe("computeCopilotAdvancedInsights", () => {
  it("derives owner improvement from month-over-month completions", () => {
    const insights = buildInsights();
    expect(insights.ownerImprovement).not.toBeNull();
    expect(insights.ownerImprovement?.ownerLabel).toBe("Rahul");
    expect(insights.ownerImprovement?.thisMonthCompletions).toBe(2);
    expect(insights.ownerImprovement?.lastMonthCompletions).toBe(1);
    expect(insights.ownerImprovement?.delta).toBe(1);
  });

  it("ranks meetings by task count", () => {
    const insights = buildInsights();
    expect(insights.meetingsMostTasks[0]?.meetingTitle).toBe("standup");
    expect(insights.meetingsMostTasks[0]?.taskCount).toBe(5);
  });

  it("lists at-risk tasks with overdue first", () => {
    const insights = buildInsights();
    expect(insights.atRiskTasks.length).toBeGreaterThan(0);
    expect(insights.atRiskTasks[0]?.isOverdue).toBe(true);
    expect(insights.atRiskTasks.some((row) => row.task === "Ship dashboard")).toBe(true);
  });

  it("flags at-risk owners with attention scores", () => {
    const insights = buildInsights();
    expect(insights.atRiskOwners.length).toBeGreaterThan(0);
    expect(insights.atRiskOwners[0]?.ownerLabel).toBe("Nisarg");
    expect(insights.atRiskOwners[0]?.attentionScore).toBeGreaterThan(0);
  });

  it("builds weekly focus bullets from execution health bundle", () => {
    const insights = buildInsights();
    expect(insights.weeklyFocus.length).toBeGreaterThan(0);
    expect(insights.weeklyFocus.some((bullet) => bullet.text.includes("overdue"))).toBe(true);
  });

  it("detects execution bottlenecks from existing metrics", () => {
    const insights = buildInsights();
    expect(insights.executionBottlenecks.length).toBeGreaterThan(0);
    expect(insights.executionBottlenecks[0]?.signal).toBe("Overdue workload");
  });

  it("computes workload imbalance across owners", () => {
    const insights = buildInsights();
    expect(insights.workloadImbalance.meanAssigned).toBeGreaterThan(0);
    expect(insights.workloadImbalance.overloaded.length).toBeGreaterThanOrEqual(0);
  });
});

describe("computeCopilotAdvancedInsights owner decline", () => {
  it("detects decline when last month outperforms this month", () => {
    const decliningTasks: MeetingTaskRecord[] = [
      {
        id: "decline-1",
        meeting_id: "meeting-a",
        task: "April task",
        owner: "Alex",
        deadline: "2026-04-15",
        status: "completed",
        created_at: "2026-04-01T10:00:00.000Z",
        updated_at: "2026-04-10T10:00:00.000Z",
        started_at: "2026-04-05T10:00:00.000Z",
        completed_at: "2026-04-10T10:00:00.000Z",
      },
      {
        id: "decline-2",
        meeting_id: "meeting-a",
        task: "Open work",
        owner: "Alex",
        deadline: "2026-05-30",
        status: "pending",
        created_at: "2026-05-01T10:00:00.000Z",
        updated_at: "2026-05-01T10:00:00.000Z",
        started_at: null,
        completed_at: null,
      },
    ];

    const bundle = computeExecutionHealthBundle(decliningTasks, [], referenceDate);
    const insights = computeCopilotAdvancedInsights({
      bundle,
      meetings: [meetings[0]!],
      tasks: decliningTasks,
      referenceDate,
    });

    expect(insights.ownerDecline).not.toBeNull();
    expect(insights.ownerDecline?.ownerLabel).toBe("Alex");
    expect(insights.ownerDecline?.delta).toBe(1);
  });
});

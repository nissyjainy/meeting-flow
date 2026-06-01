import { describe, expect, it } from "vitest";
import { computeAccountabilityAnalytics } from "@/lib/analytics/accountability-analytics";
import { assembleCopilotWorkspaceContext } from "./copilot-workspace.server";
import { formatCopilotWorkspaceResponse } from "./format-response";
import type { CopilotIntent } from "./types";
import type { MeetingTaskRecord } from "@/lib/meetings/types";

const referenceDate = new Date("2026-05-28T12:00:00.000Z");

const meetingRows = [
  {
    id: "meeting-a",
    file_name: "standup.mp3",
    file_url: "user/meeting-a/standup.mp3",
    transcript: "We discussed launch tasks.",
    summary: "Team aligned on launch tasks.",
    status: "completed",
    created_at: "2026-05-20T10:00:00.000Z",
  },
];

const dashboardMeetingRows = meetingRows.map((row) => ({
  id: row.id,
  file_name: row.file_name,
  summary: row.summary,
  status: row.status,
  created_at: row.created_at,
  transcript: row.transcript,
}));

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
];

const membersByMeeting = new Map([
  [
    "meeting-a",
    [
      { id: "member-1", name: "Nisarg", email: "nisarg@example.com" },
      { id: "member-2", name: "Rahul", email: "rahul@example.com" },
    ],
  ],
]);

function buildAnalyticsWorkspace() {
  return assembleCopilotWorkspaceContext({
    meetingRows,
    dashboardMeetingRows,
    tasks,
    taskStatusEvents: [],
    membersByMeeting,
    reminderHistoryRows: [],
    remindersSent: 0,
    appUrl: "http://localhost:8080",
    referenceDate,
  });
}

const ANALYTICS_INTENTS = [
  "completion_rate",
  "on_time_completion",
  "average_completion_time",
  "best_performer",
  "most_delayed_owner",
  "weekly_completion_trend",
  "execution_health",
] as const satisfies readonly CopilotIntent[];

describe("formatCopilotWorkspaceResponse analytics intents", () => {
  it.each(ANALYTICS_INTENTS)("returns a valid response for %s", (intent) => {
    const workspace = buildAnalyticsWorkspace();
    const answer = formatCopilotWorkspaceResponse(intent, workspace);

    expect(answer).not.toMatch(/^ERROR:/);
    expect(answer).not.toContain("Cannot destructure");
    expect(answer).not.toBe("Analytics data is not available yet.");
    expect(answer.length).toBeGreaterThan(0);
  });

  it("formats completion_rate with KPI values", () => {
    const answer = formatCopilotWorkspaceResponse("completion_rate", buildAnalyticsWorkspace());
    expect(answer).toContain("Team completion rate:");
    expect(answer).toContain("50%");
    expect(answer).toContain("1 of 2 tasks completed");
  });

  it("formats on_time_completion with on-time percentage", () => {
    const answer = formatCopilotWorkspaceResponse("on_time_completion", buildAnalyticsWorkspace());
    expect(answer).toContain("On-time completion rate:");
    expect(answer).toContain("100%");
  });

  it("formats average_completion_time without shadowing errors", () => {
    const answer = formatCopilotWorkspaceResponse(
      "average_completion_time",
      buildAnalyticsWorkspace(),
    );
    expect(answer).toContain("Average completion time:");
    expect(answer).toContain("2.0d avg");
  });

  it("formats best_performer with owner insight", () => {
    const answer = formatCopilotWorkspaceResponse("best_performer", buildAnalyticsWorkspace());
    expect(answer).toContain("Best performer");
    expect(answer).toContain("Rahul");
  });

  it("formats most_delayed_owner with owner insight", () => {
    const answer = formatCopilotWorkspaceResponse("most_delayed_owner", buildAnalyticsWorkspace());
    expect(answer).toContain("Most delayed owner:");
    expect(answer).toContain("Nisarg");
  });

  it("formats weekly_completion_trend with weekly data", () => {
    const answer = formatCopilotWorkspaceResponse(
      "weekly_completion_trend",
      buildAnalyticsWorkspace(),
    );
    expect(answer).toContain("Weekly completion trend");
    expect(answer).toContain("1 completed");
  });

  it("formats execution_health with KPI and owner sections", () => {
    const answer = formatCopilotWorkspaceResponse("execution_health", buildAnalyticsWorkspace());
    expect(answer).toContain("Execution health summary:");
    expect(answer).toContain("Completion rate: 50%");
    expect(answer).toContain("2.0d avg");
    expect(answer).toContain("Best performer: Rahul");
    expect(answer).toContain("Most delayed: Nisarg");
  });

  it("returns guard message when accountability is missing", () => {
    const workspace = buildAnalyticsWorkspace();
    const broken = { ...workspace, accountability: undefined as never };

    for (const intent of ANALYTICS_INTENTS) {
      expect(formatCopilotWorkspaceResponse(intent, broken)).toBe(
        "Analytics data is not available yet.",
      );
    }
  });

  it("formats completion_stats with accountability KPIs", () => {
    const answer = formatCopilotWorkspaceResponse("completion_stats", buildAnalyticsWorkspace());
    expect(answer).toContain("Accountability KPIs:");
    expect(answer).toContain("Completion rate: 50%");
    expect(answer).toContain("2.0d avg");
  });
});

describe("computeAccountabilityAnalytics fixture sanity", () => {
  it("matches expected KPIs for audit fixture", () => {
    const analytics = computeAccountabilityAnalytics(tasks, [], referenceDate);
    expect(analytics.kpis.completionRate).toBe(50);
    expect(analytics.kpis.onTimeCompletionRate).toBe(100);
    expect(analytics.kpis.averageCompletionHours).toBe(48);
  });
});

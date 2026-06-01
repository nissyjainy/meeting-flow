import { describe, expect, it } from "vitest";
import { assembleCopilotWorkspaceContext } from "./copilot-workspace.server";
import { formatAdvancedCopilotResponse } from "./format-advanced-insights";
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

function buildWorkspace() {
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

const ADVANCED_INTENTS = [
  "owner_improvement",
  "owner_decline",
  "execution_bottlenecks",
  "meetings_most_tasks",
  "at_risk_owners",
  "at_risk_tasks",
  "weekly_focus",
  "workload_imbalance",
  "executive_briefing",
] as const satisfies readonly CopilotIntent[];

describe("formatAdvancedCopilotResponse", () => {
  it.each(ADVANCED_INTENTS)("returns a valid response for %s", (intent) => {
    const workspace = buildWorkspace();
    const answer = formatAdvancedCopilotResponse(intent, workspace);

    expect(answer).not.toBe("Advanced insights are not available yet.");
    expect(answer.length).toBeGreaterThan(0);
  });

  it("formats weekly_focus with actionable bullets", () => {
    const answer = formatAdvancedCopilotResponse("weekly_focus", buildWorkspace());
    expect(answer).toContain("Focus this week:");
    expect(answer).toContain("•");
  });

  it("formats executive_briefing with health score and summary", () => {
    const answer = formatAdvancedCopilotResponse("executive_briefing", buildWorkspace());
    expect(answer).toContain("Executive briefing:");
    expect(answer).toContain("Execution Health is");
    expect(answer).toContain("Health score:");
    expect(answer).toContain("Recommended focus:");
  });

  it("formats at_risk_tasks without misrouting to task list", () => {
    const answer = formatAdvancedCopilotResponse("at_risk_tasks", buildWorkspace());
    expect(answer).toContain("Tasks most at risk:");
    expect(answer).not.toContain("action item");
  });

  it("returns guard message when advanced insights are missing", () => {
    const workspace = buildWorkspace();
    const broken = { ...workspace, advancedInsights: undefined as never };

    for (const intent of ADVANCED_INTENTS) {
      expect(formatAdvancedCopilotResponse(intent, broken)).toBe(
        "Advanced insights are not available yet.",
      );
    }
  });

  it("documents deterministic example outputs for all advanced intents", () => {
    const workspace = buildWorkspace();
    const examples = Object.fromEntries(
      ADVANCED_INTENTS.map((intent) => [intent, formatAdvancedCopilotResponse(intent, workspace)]),
    ) as Record<(typeof ADVANCED_INTENTS)[number], string>;

    expect(examples.owner_improvement).toContain("Rahul");
    expect(examples.weekly_focus).toContain("Focus this week:");
    expect(examples.executive_briefing).toContain("Executive briefing:");
    expect(examples.at_risk_tasks).toContain("Ship dashboard");
    expect(examples.execution_bottlenecks).toContain("Overdue workload");
    expect(examples.meetings_most_tasks).toContain("standup");
  });
});

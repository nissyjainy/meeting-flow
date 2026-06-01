import { describe, expect, it } from "vitest";
import {
  assembleCopilotWorkspaceContext,
  buildCopilotMeetingSummaries,
  buildCopilotReminderHistoryEntries,
} from "./copilot-workspace.server";
import type { MeetingTaskRecord } from "@/lib/meetings/types";

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
  {
    id: "meeting-b",
    file_name: "planning.mp4",
    file_url: "user/meeting-b/planning.mp4",
    transcript: null,
    summary: null,
    status: "processing",
    created_at: "2026-05-21T10:00:00.000Z",
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

describe("assembleCopilotWorkspaceContext", () => {
  it("builds meetings, tasks, execution metrics, and reminder history", () => {
    const referenceDate = new Date("2026-05-28T12:00:00.000Z");

    const context = assembleCopilotWorkspaceContext({
      meetingRows,
      dashboardMeetingRows,
      tasks,
      taskStatusEvents: [],
      membersByMeeting,
      reminderHistoryRows: [
        {
          id: "send-1",
          meeting_id: "meeting-a",
          recipient: "nisarg@example.com",
          subject: "Task reminders",
          sent_at: "2026-05-27T09:00:00.000Z",
        },
      ],
      remindersSent: 1,
      appUrl: "http://localhost:8080",
      referenceDate,
    });

    expect(context.meetings).toHaveLength(2);
    expect(context.meetings[0]?.meetingTitle).toBe("standup");
    expect(context.meetings[0]?.taskCount).toBe(2);
    expect(context.tasks).toHaveLength(2);
    expect(context.tasks[0]?.ownerEmail).toBe("nisarg@example.com");
    expect(context.tasks[0]?.meetingTitle).toBe("standup");
    expect(context.execution.totalOpen).toBe(1);
    expect(context.taskStats.completedTasks).toBe(1);
    expect(context.accountability.kpis.completionRate).toBe(50);
    expect(context.executionHealth.overview.healthScore).toBeGreaterThanOrEqual(0);
    expect(context.advancedInsights.weeklyFocus.length).toBeGreaterThan(0);
    expect(context.advancedInsights.meetingsMostTasks[0]?.taskCount).toBe(2);
    expect(context.topPriorities).toHaveLength(1);
    expect(context.remindersSent).toBe(1);
    expect(context.reminderHistory).toHaveLength(1);
    expect(context.reminderHistory[0]?.recipient).toBe("nisarg@example.com");
  });
});

describe("buildCopilotMeetingSummaries", () => {
  it("maps pipeline status and task counts", () => {
    const taskCountByMeeting = new Map([
      ["meeting-a", 2],
      ["meeting-b", 0],
    ]);

    const summaries = buildCopilotMeetingSummaries(meetingRows, taskCountByMeeting);

    expect(summaries[0]?.pipelineStatus).toBe("ready");
    expect(summaries[1]?.pipelineStatus).toBe("processing");
    expect(summaries[1]?.taskCount).toBe(0);
  });
});

describe("buildCopilotReminderHistoryEntries", () => {
  it("resolves meeting titles for reminder rows", () => {
    const entries = buildCopilotReminderHistoryEntries(
      [
        {
          id: "send-1",
          meeting_id: "meeting-a",
          recipient: "nisarg@example.com",
          subject: "Reminder",
          sent_at: "2026-05-27T09:00:00.000Z",
        },
        {
          id: "send-2",
          meeting_id: null,
          recipient: "ops@example.com",
          subject: null,
          sent_at: "2026-05-26T09:00:00.000Z",
        },
      ],
      meetingRows,
    );

    expect(entries[0]?.meetingTitle).toBe("standup");
    expect(entries[1]?.meetingTitle).toBe("Unknown meeting");
  });
});

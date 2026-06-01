import { describe, expect, it } from "vitest";
import { buildNotifications } from "./build-notifications";
import type { MeetingRecord } from "@/lib/meetings/types";

const meeting: MeetingRecord = {
  id: "m-1",
  file_name: "planning-sync.mp3",
  file_url: "user/m-1/planning-sync.mp3",
  transcript: "hello",
  summary: "Summary text",
  status: "ready",
  created_at: "2026-05-28T10:00:00.000Z",
  title: "planning sync",
  mime_type: "audio/mpeg",
  file_path: "user/m-1/planning-sync.mp3",
  transcript_text: "hello",
  transcript_status: "completed",
  transcript_error: null,
  file_size: null,
};

describe("buildNotifications", () => {
  it("maps completed meetings to summary notifications", () => {
    const items = buildNotifications({
      meetings: [meeting],
      tasks: [],
      taskStatusEvents: [],
      reminderSends: [],
      referenceDate: new Date("2026-05-28T12:00:00.000Z"),
    });

    expect(items.some((item) => item.id === "meeting-summary:m-1")).toBe(true);
    expect(items.find((item) => item.id === "meeting-summary:m-1")?.title).toBe("AI summary ready");
  });

  it("maps failed meetings and extracted tasks", () => {
    const items = buildNotifications({
      meetings: [{ ...meeting, status: "failed", summary: null }],
      tasks: [
        {
          id: "t-1",
          meeting_id: "m-1",
          task: "Follow up with design",
          owner: "Alex",
          deadline: null,
          status: "pending",
          created_at: "2026-05-28T11:00:00.000Z",
          updated_at: "2026-05-28T11:00:00.000Z",
          started_at: null,
          completed_at: null,
        },
      ],
      taskStatusEvents: [],
      reminderSends: [],
      referenceDate: new Date("2026-05-28T12:00:00.000Z"),
    });

    expect(items.some((item) => item.id === "meeting-failed:m-1")).toBe(true);
    expect(items.some((item) => item.id === "tasks-extracted:m-1")).toBe(true);
  });
});

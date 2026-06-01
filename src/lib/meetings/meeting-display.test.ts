import { describe, expect, it } from "vitest";
import type { MeetingRecord } from "./types";
import { getPipelineDisplayStatus } from "./meeting-display";

function meeting(overrides: Partial<MeetingRecord>): MeetingRecord {
  return {
    id: "m1",
    file_name: "call.mp3",
    file_url: "user/m1/call.mp3",
    transcript: null,
    summary: null,
    status: "processing",
    created_at: "2026-05-20T10:00:00.000Z",
    title: "call",
    mime_type: "audio/mpeg",
    file_path: "user/m1/call.mp3",
    transcript_text: null,
    transcript_status: "queued",
    transcript_error: null,
    file_size: null,
    ...overrides,
  };
}

describe("getPipelineDisplayStatus", () => {
  it("stays processing when transcript exists but pipeline is not finished", () => {
    expect(
      getPipelineDisplayStatus(
        meeting({
          transcript: "Hello team",
          transcript_text: "Hello team",
          status: "processing",
        }),
      ),
    ).toBe("processing");
  });

  it("returns completed only when UI status is ready (DB completed)", () => {
    expect(
      getPipelineDisplayStatus(
        meeting({
          transcript: "Hello team",
          transcript_text: "Hello team",
          summary: "Summary here",
          status: "ready",
        }),
      ),
    ).toBe("completed");
  });

  it("returns failed when meeting status is failed", () => {
    expect(getPipelineDisplayStatus(meeting({ status: "failed" }))).toBe("failed");
  });
});

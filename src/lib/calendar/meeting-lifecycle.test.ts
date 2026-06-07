import { describe, expect, it } from "vitest";
import { getCalendarMeetingLifecycle } from "./meeting-lifecycle";
import type { CalendarEventRecord } from "./types";

function eventAt(start: string, end: string): Pick<CalendarEventRecord, "status" | "starts_at" | "ends_at"> {
  return {
    status: "scheduled",
    starts_at: start,
    ends_at: end,
  };
}

describe("getCalendarMeetingLifecycle", () => {
  const now = new Date("2026-06-07T15:00:00.000Z");

  it("marks future meetings as upcoming", () => {
    expect(
      getCalendarMeetingLifecycle(
        eventAt("2026-06-07T16:00:00.000Z", "2026-06-07T17:00:00.000Z"),
        now,
      ),
    ).toBe("upcoming");
  });

  it("marks active meetings as in_progress", () => {
    expect(
      getCalendarMeetingLifecycle(
        eventAt("2026-06-07T14:00:00.000Z", "2026-06-07T16:00:00.000Z"),
        now,
      ),
    ).toBe("in_progress");
  });

  it("marks past meetings as completed", () => {
    expect(
      getCalendarMeetingLifecycle(
        eventAt("2026-06-07T12:00:00.000Z", "2026-06-07T13:00:00.000Z"),
        now,
      ),
    ).toBe("completed");
  });

  it("marks cancelled calendar events", () => {
    expect(
      getCalendarMeetingLifecycle(
        { status: "cancelled", starts_at: "2026-06-07T16:00:00.000Z", ends_at: "2026-06-07T17:00:00.000Z" },
        now,
      ),
    ).toBe("cancelled");
  });
});

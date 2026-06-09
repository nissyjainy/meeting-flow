import { describe, expect, it } from "vitest";
import { extractUserIdFromMeetingPath } from "./meeting-chunks-index.server";

describe("extractUserIdFromMeetingPath", () => {
  it("extracts user id from storage path", () => {
    const userId = "77098070-ee93-4655-b02b-b62510129f44";
    const meetingId = "8ca7a622-9d91-4397-bfb1-6aa07e6c9e38";
    expect(extractUserIdFromMeetingPath(`${userId}/${meetingId}/capture.webm`)).toBe(userId);
  });

  it("returns null for invalid paths", () => {
    expect(extractUserIdFromMeetingPath(null)).toBeNull();
    expect(extractUserIdFromMeetingPath("not-a-uuid/meeting/file.webm")).toBeNull();
  });
});

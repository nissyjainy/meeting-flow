import { describe, expect, it } from "vitest";
import {
  buildConferenceRecordsFilter,
  conferenceRecordIdFromName,
  pickBestConferenceRecord,
  pickReadyTranscript,
} from "./meet-api-client";

describe("buildConferenceRecordsFilter", () => {
  it("includes meeting code and time window", () => {
    const filter = buildConferenceRecordsFilter({
      meetingCode: "abc-defg-hij",
      startsAt: "2026-06-07T14:00:00.000Z",
      endsAt: "2026-06-07T15:00:00.000Z",
      bufferMinutes: 15,
    });

    expect(filter).toContain('space.meeting_code = "abc-defg-hij"');
    expect(filter).toContain("start_time >=");
    expect(filter).toContain("start_time <=");
  });
});

describe("conferenceRecordIdFromName", () => {
  it("strips resource prefix", () => {
    expect(conferenceRecordIdFromName("conferenceRecords/abc123")).toBe("abc123");
  });
});

describe("pickReadyTranscript", () => {
  it("prefers FILE_GENERATED transcripts", () => {
    const picked = pickReadyTranscript([
      { name: "conferenceRecords/a/transcripts/1", state: "ENDED" },
      { name: "conferenceRecords/a/transcripts/2", state: "FILE_GENERATED" },
    ]);

    expect(picked?.name).toBe("conferenceRecords/a/transcripts/2");
  });
});

describe("pickBestConferenceRecord", () => {
  it("picks the record with the best time overlap", () => {
    const picked = pickBestConferenceRecord(
      [
        {
          name: "conferenceRecords/older",
          startTime: "2026-06-07T10:00:00.000Z",
          endTime: "2026-06-07T10:30:00.000Z",
        },
        {
          name: "conferenceRecords/match",
          startTime: "2026-06-07T14:00:00.000Z",
          endTime: "2026-06-07T15:00:00.000Z",
        },
      ],
      "2026-06-07T14:00:00.000Z",
      "2026-06-07T15:00:00.000Z",
    );

    expect(picked?.name).toBe("conferenceRecords/match");
  });
});

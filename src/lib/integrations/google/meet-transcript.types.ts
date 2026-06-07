export type MeetTranscriptFetchErrorCode =
  | "needs_reconnect"
  | "not_connected"
  | "not_configured"
  | "not_found"
  | "not_ready"
  | "forbidden"
  | "missing_meeting_code"
  | "not_completed"
  | "error";

export type MeetTranscriptFetchResult =
  | {
      success: true;
      transcript: string;
      conferenceRecordId: string;
      entryCount: number;
    }
  | {
      success: false;
      code: MeetTranscriptFetchErrorCode;
      message: string;
    };

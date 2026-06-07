import type { MeetingPlatform } from "@/lib/meetings/detect-meeting-platform";

export type CalendarAttendee = {
  email: string;
  displayName: string | null;
  responseStatus: string | null;
};

export type CalendarCaptureStatus =
  | "discovered"
  | "pending_capture"
  | "capturing"
  | "captured"
  | "failed";

export type CalendarTranscriptStatus =
  | "not_started"
  | "queued"
  | "processing"
  | "completed"
  | "failed";

export type CalendarEventRecord = {
  id: string;
  user_id: string;
  google_event_id: string;
  google_calendar_id: string;
  title: string;
  organizer_email: string | null;
  organizer_name: string | null;
  starts_at: string;
  ends_at: string;
  attendees: CalendarAttendee[];
  /** @deprecated Prefer meeting_url */
  meet_link: string | null;
  platform: MeetingPlatform | null;
  meeting_url: string | null;
  meeting_code: string | null;
  google_conference_id: string | null;
  capture_status: CalendarCaptureStatus;
  transcript_status: CalendarTranscriptStatus;
  status: "scheduled" | "cancelled";
  linked_meeting_id: string | null;
  synced_at: string;
  created_at: string;
  updated_at: string;
};

import type { MeetingRecord } from "@/lib/meetings/types";

export type MeetingsListItem =
  | { kind: "upload"; meeting: MeetingRecord; sortAt: string }
  | { kind: "scheduled"; event: CalendarEventRecord; sortAt: string };

export type MeetingFilter = "all" | "ready" | "processing" | "scheduled";

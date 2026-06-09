import type { SupabaseClient } from "@supabase/supabase-js";
import { meetingUrlsLikelyMatch, resolveCaptureMeetingCode } from "./resolve-capture-title";

type CalendarEventMatchRow = {
  id: string;
  title: string;
  meeting_url: string | null;
  meet_link: string | null;
  meeting_code: string | null;
  starts_at: string;
  ends_at: string;
};

export async function findCalendarEventTitleForCapture(
  supabase: SupabaseClient,
  userId: string,
  input: { meetUrl?: string | null; meetingCode?: string | null },
): Promise<string | null> {
  const now = Date.now();
  const windowStart = new Date(now - 3 * 60 * 60 * 1000).toISOString();
  const windowEnd = new Date(now + 2 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("calendar_events")
    .select("id,title,meeting_url,meet_link,meeting_code,starts_at,ends_at")
    .eq("user_id", userId)
    .eq("status", "scheduled")
    .gte("ends_at", windowStart)
    .lte("starts_at", windowEnd)
    .order("starts_at", { ascending: true });

  if (error || !data?.length) {
    return null;
  }

  const events = data as CalendarEventMatchRow[];
  const captureCode = resolveCaptureMeetingCode(input.meetingCode, input.meetUrl)?.toLowerCase();

  if (captureCode) {
    const codeMatch = events.find(
      (event) => event.meeting_code?.trim().toLowerCase() === captureCode,
    );
    if (codeMatch?.title?.trim()) {
      return codeMatch.title.trim();
    }
  }

  if (input.meetUrl?.trim()) {
    const urlMatch = events.find((event) => {
      const eventUrl = event.meeting_url ?? event.meet_link;
      return meetingUrlsLikelyMatch(input.meetUrl, eventUrl);
    });
    if (urlMatch?.title?.trim()) {
      return urlMatch.title.trim();
    }
  }

  const inProgress = events.filter((event) => {
    const startMs = new Date(event.starts_at).getTime();
    const endMs = new Date(event.ends_at).getTime();
    return startMs <= now && endMs >= now;
  });

  if (inProgress.length === 1 && inProgress[0].title?.trim()) {
    return inProgress[0].title.trim();
  }

  return null;
}

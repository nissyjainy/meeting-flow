import { describe, expect, it } from "vitest";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { shouldReplaceTitleWithAiGeneratedTitle } from "./resolve-capture-title";
import { persistAiMeetingTitleIfNeeded } from "./title-pipeline.server";
import { generateMeetingTitleFromTranscript } from "./title-groq";

const hasGroq = Boolean(process.env.GROQ_API_KEY?.trim());
const hasAdmin = Boolean(
  process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() && process.env.VITE_SUPABASE_URL?.trim(),
);

const VERIFICATION_MEETING_ID = "8ca7a622-9d91-4397-bfb1-6aa07e6c9e38";

describe.runIf(hasGroq)("generateMeetingTitleFromTranscript (live Groq)", () => {
  it("returns a short descriptive title from transcript content", async () => {
    const transcript =
      "Today we are doing MeetFlow production verification and testing whether Groq transcription works end to end in the worker.";
    const title = await generateMeetingTitleFromTranscript(transcript);

    expect(title.length).toBeGreaterThan(5);
    expect(title.toLowerCase()).not.toContain("xxu-jmdw-eno");
    expect(title.split(/\s+/).length).toBeLessThanOrEqual(12);
  }, 60_000);
});

describe.runIf(hasGroq && hasAdmin)("persistAiMeetingTitleIfNeeded (live e2e)", () => {
  it("replaces meet-code title on a completed meeting", async () => {
    const admin = getSupabaseAdminClient();
    if (!admin) {
      throw new Error("Admin client unavailable.");
    }

    const { data: meeting, error: fetchError } = await admin
      .from("meetings")
      .select("id,title,meeting_code,transcript")
      .eq("id", VERIFICATION_MEETING_ID)
      .maybeSingle();

    expect(fetchError).toBeNull();
    expect(meeting?.transcript?.trim()).toBeTruthy();

    if (
      !shouldReplaceTitleWithAiGeneratedTitle(meeting?.title, meeting?.meeting_code)
    ) {
      expect(meeting?.title?.trim()).toBeTruthy();
      return;
    }

    const outcome = await persistAiMeetingTitleIfNeeded(
      admin,
      VERIFICATION_MEETING_ID,
      meeting!.transcript!,
      meeting!.title,
      meeting!.meeting_code,
    );

    expect(outcome.replaced).toBe(true);
    expect(outcome.title?.trim()).toBeTruthy();
    expect(outcome.title!.toLowerCase()).not.toBe("xxu-jmdw-eno");

    const { data: updated } = await admin
      .from("meetings")
      .select("title")
      .eq("id", VERIFICATION_MEETING_ID)
      .maybeSingle();

    expect(updated?.title).toBe(outcome.title);
    expect(updated?.title?.toLowerCase()).not.toBe("xxu-jmdw-eno");
  }, 90_000);
});

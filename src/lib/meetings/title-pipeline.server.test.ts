import { describe, expect, it, vi, beforeEach } from "vitest";
import { persistAiMeetingTitleIfNeeded } from "./title-pipeline.server";

const generateMeetingTitleFromTranscript = vi.fn();
const shouldReplaceTitleWithAiGeneratedTitle = vi.fn();

vi.mock("./title-groq", () => ({
  generateMeetingTitleFromTranscript: (...args: unknown[]) =>
    generateMeetingTitleFromTranscript(...args),
  sanitizeMeetingTitle: (raw: string) => raw?.trim() || null,
}));

vi.mock("./resolve-capture-title", () => ({
  shouldReplaceTitleWithAiGeneratedTitle: (...args: unknown[]) =>
    shouldReplaceTitleWithAiGeneratedTitle(...args),
}));

describe("persistAiMeetingTitleIfNeeded", () => {
  const meetingId = "8ca7a622-9d91-4397-bfb1-6aa07e6c9e38";
  const transcript = "We are testing MeetFlow production verification today.";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("skips when existing title should be preserved", async () => {
    shouldReplaceTitleWithAiGeneratedTitle.mockReturnValue(false);

    const update = vi.fn();
    const supabase = {
      from: vi.fn().mockReturnValue({
        update: update,
      }),
    };

    const outcome = await persistAiMeetingTitleIfNeeded(
      supabase as never,
      meetingId,
      transcript,
      "Weekly Product Sync",
      "xxu-jmdw-eno",
    );

    expect(outcome.replaced).toBe(false);
    expect(outcome.skippedReason).toBe("existing title is user-friendly or calendar-derived");
    expect(generateMeetingTitleFromTranscript).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it("persists AI title when replacement is allowed", async () => {
    shouldReplaceTitleWithAiGeneratedTitle.mockReturnValue(true);
    generateMeetingTitleFromTranscript.mockResolvedValue("MeetFlow Production Verification");

    const eq = vi.fn().mockResolvedValue({ error: null });
    const update = vi.fn().mockReturnValue({ eq });
    const supabase = {
      from: vi.fn().mockReturnValue({
        update,
      }),
    };

    const outcome = await persistAiMeetingTitleIfNeeded(
      supabase as never,
      meetingId,
      transcript,
      "xxu-jmdw-eno",
      "xxu-jmdw-eno",
    );

    expect(outcome.replaced).toBe(true);
    expect(outcome.title).toBe("MeetFlow Production Verification");
    expect(update).toHaveBeenCalledWith({ title: "MeetFlow Production Verification" });
    expect(eq).toHaveBeenCalledWith("id", meetingId);
  });

  it("keeps existing title when generation fails", async () => {
    shouldReplaceTitleWithAiGeneratedTitle.mockReturnValue(true);
    generateMeetingTitleFromTranscript.mockRejectedValue(new Error("Groq unavailable"));

    const supabase = {
      from: vi.fn(),
    };

    const outcome = await persistAiMeetingTitleIfNeeded(
      supabase as never,
      meetingId,
      transcript,
      "atz-isnx-pfi",
      "atz-isnx-pfi",
    );

    expect(outcome.replaced).toBe(false);
    expect(outcome.skippedReason).toBe("generation failed");
    expect(supabase.from).not.toHaveBeenCalled();
  });
});

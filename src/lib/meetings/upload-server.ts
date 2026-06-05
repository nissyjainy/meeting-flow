import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { enrichMeetingRecord } from "./record";
import type { MeetingRecord } from "./types";
import { uploadDebug, uploadDebugError, uploadDebugReturn } from "./upload-debug";

const CreateMeetingRecordInput = z.object({
  meetingId: z.string().uuid(),
  fileName: z.string().min(1),
  fileUrl: z.string().min(1),
  transcript: z.string().nullable().optional(),
});

export const createMeetingRecordFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => {
    uploadDebug("DB insert inputValidator started (server)");
    try {
      const parsed = CreateMeetingRecordInput.parse(input);
      uploadDebug("DB insert inputValidator success (server)", {
        meetingId: parsed.meetingId,
        fileName: parsed.fileName,
      });
      return parsed;
    } catch (error) {
      uploadDebugError("DB insert inputValidator failed (server)", error, { input });
      throw error;
    }
  })
  .handler(async ({ data }): Promise<MeetingRecord> => {
    uploadDebug("DB insert handler started (server)", {
      meetingId: data.meetingId,
      fileName: data.fileName,
      fileUrl: data.fileUrl,
    });

    try {
      const supabase = getSupabaseServerClient();

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        const err = new Error("You must be signed in to save a meeting.");
        uploadDebugError("DB insert auth failed (server)", err, { authError });
        throw err;
      }

      uploadDebug("DB insert executing supabase.insert (server)", {
        userId: user.id,
        meetingId: data.meetingId,
      });

      const { data: record, error } = await supabase
        .from("meetings")
        .insert({
          id: data.meetingId,
          file_name: data.fileName,
          file_url: data.fileUrl,
          transcript: data.transcript ?? null,
          status: "processing",
        })
        .select("id,file_name,file_url,transcript,summary,status,transcript_error,created_at")
        .single();

      if (error) {
        uploadDebugError("DB insert supabase error (server)", error, {
          meetingId: data.meetingId,
          code: error.code,
          details: error.details,
          hint: error.hint,
        });
        throw new Error(error.message);
      }

      const enriched = enrichMeetingRecord(record);
      uploadDebug("DB insert success (server)", { recordId: enriched.id });
      return uploadDebugReturn("createMeetingRecordFn handler success", enriched, {
        recordId: enriched.id,
      });
    } catch (error) {
      uploadDebugError("DB insert handler catch (server)", error);
      throw error;
    }
  });

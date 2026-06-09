import type { SupabaseClient } from "@supabase/supabase-js";
import { generateEmbeddings } from "./embeddings.server";
import { chunkTranscript } from "./transcript-chunking";
import { uploadDebug, uploadDebugError } from "./upload-debug";

const EMBEDDING_BATCH_SIZE = 16;

export function extractUserIdFromMeetingPath(fileUrl: string | null | undefined): string | null {
  const path = fileUrl?.trim();
  if (!path) return null;
  const segment = path.split("/").filter(Boolean)[0];
  if (!segment || !/^[0-9a-f-]{36}$/i.test(segment)) return null;
  return segment;
}

async function embedInBatches(texts: string[]): Promise<number[][]> {
  const all: number[][] = [];
  for (let i = 0; i < texts.length; i += EMBEDDING_BATCH_SIZE) {
    const batch = texts.slice(i, i + EMBEDDING_BATCH_SIZE);
    const vectors = await generateEmbeddings(batch);
    all.push(...vectors);
  }
  return all;
}

/**
 * Chunks transcript, embeds with Workers AI, and stores rows in meeting_chunks.
 * Non-fatal: logs errors and returns without throwing.
 */
export async function indexMeetingTranscriptChunks(
  supabase: SupabaseClient,
  meetingId: string,
  transcript: string,
): Promise<{ indexed: boolean; chunkCount: number }> {
  uploadDebug("meeting chunks index started", { meetingId });

  try {
    const chunks = chunkTranscript(transcript);
    if (chunks.length === 0) {
      uploadDebug("meeting chunks index skipped — empty transcript", { meetingId });
      return { indexed: false, chunkCount: 0 };
    }

    const { data: meeting, error: meetingError } = await supabase
      .from("meetings")
      .select("id,file_url")
      .eq("id", meetingId)
      .maybeSingle();

    if (meetingError) {
      throw new Error(`Fetch meeting for chunk index failed: ${meetingError.message}`);
    }
    if (!meeting) {
      throw new Error("Meeting not found for chunk indexing.");
    }

    const userId = extractUserIdFromMeetingPath(meeting.file_url);
    const embeddings = await embedInBatches(chunks.map((chunk) => chunk.text));

    const { error: deleteError } = await supabase
      .from("meeting_chunks")
      .delete()
      .eq("meeting_id", meetingId);

    if (deleteError) {
      throw new Error(`Delete existing chunks failed: ${deleteError.message}`);
    }

    const rows = chunks.map((chunk, index) => ({
      meeting_id: meetingId,
      user_id: userId,
      chunk_index: chunk.chunkIndex,
      chunk_text: chunk.text,
      embedding: embeddings[index],
    }));

    const { error: insertError } = await supabase.from("meeting_chunks").insert(rows);

    if (insertError) {
      throw new Error(`Insert meeting chunks failed: ${insertError.message}`);
    }

    uploadDebug("meeting chunks index success", { meetingId, chunkCount: rows.length });
    return { indexed: true, chunkCount: rows.length };
  } catch (error) {
    uploadDebugError("meeting chunks index failed (non-fatal)", error, { meetingId });
    return { indexed: false, chunkCount: 0 };
  }
}

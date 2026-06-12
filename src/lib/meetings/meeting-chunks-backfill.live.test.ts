import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { ensureServerEnvLoaded } from "@/lib/server-env.node";
import { generateQueryEmbedding } from "./embeddings.server";
import { indexMeetingTranscriptChunks } from "./meeting-chunks-index.server";

ensureServerEnvLoaded();

const hasEnv = Boolean(
  process.env.GROQ_API_KEY?.trim() &&
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() &&
    process.env.VITE_SUPABASE_URL?.trim(),
);

describe.runIf(hasEnv)("meeting chunks backfill (live)", () => {
  it("indexes all meetings with transcripts", async () => {
    const supabase = createClient(
      process.env.VITE_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    const { data: meetings, error } = await supabase
      .from("meetings")
      .select("id,transcript")
      .not("transcript", "is", null)
      .order("created_at", { ascending: true });

    expect(error).toBeNull();

    const rows = (meetings ?? []).filter((row) => row.transcript?.trim());
    let indexed = 0;
    let totalChunks = 0;

    for (const row of rows) {
      const outcome = await indexMeetingTranscriptChunks(
        supabase,
        row.id,
        row.transcript!,
      );
      if (outcome.indexed) {
        indexed += 1;
        totalChunks += outcome.chunkCount;
      }
    }

    console.log("BACKFILL_SUMMARY", JSON.stringify({ meetings: rows.length, indexed, totalChunks }));

    const { count } = await supabase
      .from("meeting_chunks")
      .select("*", { count: "exact", head: true });

    expect(indexed).toBeGreaterThan(0);
    expect(count ?? 0).toBeGreaterThan(0);
  }, 600_000);

  it("runs sample semantic retrieval queries", async () => {
    const supabase = createClient(
      process.env.VITE_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    const samples = [
      "project status and report deadlines",
      "Groq transcription testing",
      "MBA placements discussion",
    ];

    for (const query of samples) {
      const embedding = await generateQueryEmbedding(query);
      const { data, error } = await supabase.rpc("match_meeting_chunks", {
        query_embedding: embedding,
        match_count: 3,
        filter_meeting_id: null,
      });

      expect(error).toBeNull();
      console.log(
        "SEMANTIC_QUERY",
        JSON.stringify({
          query,
          hits: (data ?? []).map(
            (row: { meeting_id: string; chunk_index: number; similarity: number; chunk_text: string }) => ({
              meeting_id: row.meeting_id,
              chunk_index: row.chunk_index,
              similarity: row.similarity,
              preview: row.chunk_text.slice(0, 120),
            }),
          ),
        }),
      );
    }
  }, 120_000);
});

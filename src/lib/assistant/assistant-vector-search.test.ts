import { describe, expect, it, vi, beforeEach } from "vitest";
import { searchMeetingChunksVector } from "./assistant-vector-search.server";

const generateQueryEmbedding = vi.fn();

vi.mock("@/lib/meetings/embeddings.server", () => ({
  generateQueryEmbedding: (...args: unknown[]) => generateQueryEmbedding(...args),
}));

describe("searchMeetingChunksVector", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    generateQueryEmbedding.mockResolvedValue(Array.from({ length: 768 }, () => 0.01));
  });

  it("groups chunk rows by meeting for context assembly", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [
        {
          meeting_id: "m1",
          chunk_index: 0,
          chunk_text: "Discussed marketing launch timeline.",
          similarity: 0.91,
        },
        {
          meeting_id: "m1",
          chunk_index: 1,
          chunk_text: "Budget approval for Q3 campaigns.",
          similarity: 0.84,
        },
        {
          meeting_id: "m2",
          chunk_index: 0,
          chunk_text: "MBA placement strategy review.",
          similarity: 0.88,
        },
      ],
      error: null,
    });

    const supabase = { rpc } as never;
    const hits = await searchMeetingChunksVector(supabase, "marketing budget");

    expect(rpc).toHaveBeenCalledWith("match_meeting_chunks", {
      query_embedding: expect.any(Array),
      match_count: 12,
      filter_meeting_id: null,
    });
    expect(hits).toHaveLength(2);
    expect(hits[0]?.meetingId).toBe("m1");
    expect(hits[0]?.chunkSnippets?.length).toBe(2);
    expect(hits[0]?.matchedFields).toContain("semantic");
  });
});

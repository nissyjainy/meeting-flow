import { describe, expect, it } from "vitest";
import {
  CHUNK_MAX_WORDS,
  CHUNK_OVERLAP_WORDS,
  chunkTranscript,
} from "./transcript-chunking";

function words(count: number): string {
  return Array.from({ length: count }, (_, i) => `word${i}`).join(" ");
}

describe("chunkTranscript", () => {
  it("returns empty for blank transcript", () => {
    expect(chunkTranscript("   ")).toEqual([]);
  });

  it("returns a single chunk for short transcripts", () => {
    const text = words(120);
    const chunks = chunkTranscript(text);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]?.chunkIndex).toBe(0);
    expect(chunks[0]?.wordCount).toBe(120);
  });

  it("splits long transcripts with overlap between chunks", () => {
    const text = words(CHUNK_MAX_WORDS + CHUNK_OVERLAP_WORDS + 200);
    const chunks = chunkTranscript(text);

    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.wordCount).toBeLessThanOrEqual(CHUNK_MAX_WORDS);
    }

    const firstTail = chunks[0]?.text.split(/\s+/).slice(-CHUNK_OVERLAP_WORDS).join(" ");
    const secondHead = chunks[1]?.text.split(/\s+/).slice(0, CHUNK_OVERLAP_WORDS).join(" ");
    expect(firstTail).toBe(secondHead);
  });
});

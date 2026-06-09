/** Target chunk size for semantic retrieval (words). */
export const CHUNK_MIN_WORDS = 500;
export const CHUNK_MAX_WORDS = 800;
export const CHUNK_OVERLAP_WORDS = 100;

export type TranscriptChunk = {
  chunkIndex: number;
  text: string;
  wordCount: number;
};

function splitWords(text: string): string[] {
  return text.trim().split(/\s+/).filter(Boolean);
}

/**
 * Splits a transcript into ~500–800 word chunks with overlap between consecutive chunks.
 */
export function chunkTranscript(transcript: string): TranscriptChunk[] {
  const trimmed = transcript.trim();
  if (!trimmed) return [];

  const words = splitWords(trimmed);
  if (words.length === 0) return [];

  if (words.length <= CHUNK_MAX_WORDS) {
    return [{ chunkIndex: 0, text: trimmed, wordCount: words.length }];
  }

  const chunks: TranscriptChunk[] = [];
  let start = 0;
  let chunkIndex = 0;

  while (start < words.length) {
    const end = Math.min(start + CHUNK_MAX_WORDS, words.length);
    const slice = words.slice(start, end);
    const text = slice.join(" ");

    chunks.push({
      chunkIndex,
      text,
      wordCount: slice.length,
    });

    chunkIndex += 1;
    if (end >= words.length) break;

    const nextStart = end - CHUNK_OVERLAP_WORDS;
    start = nextStart > start ? nextStart : end;
  }

  return chunks;
}

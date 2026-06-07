export type MeetTranscriptEntry = {
  text?: string;
  startTime?: string;
  endTime?: string;
  participant?: string;
};

function formatEntryTimestamp(iso: string | undefined): string | null {
  if (!iso?.trim()) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;

  return date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function assembleMeetTranscriptText(entries: MeetTranscriptEntry[]): string {
  const lines: string[] = [];

  for (const entry of entries) {
    const text = entry.text?.trim();
    if (!text) continue;

    const timestamp = formatEntryTimestamp(entry.startTime);
    lines.push(timestamp ? `[${timestamp}] ${text}` : text);
  }

  return lines.join("\n\n").trim();
}

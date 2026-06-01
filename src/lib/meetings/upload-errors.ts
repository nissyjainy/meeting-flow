type ZodIssue = { message?: string; path?: (string | number)[] };

function isZodIssueArray(value: unknown): value is ZodIssue[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        item != null &&
        typeof item === "object" &&
        ("message" in item || "path" in item),
    )
  );
}

export function formatUploadError(err: unknown, context: "upload" | "transcription" = "upload"): string {
  const prefix =
    context === "transcription"
      ? "Transcription failed"
      : "Upload failed";

  if (err instanceof Error) {
    const trimmed = err.message.trim();
    if (!trimmed) return `${prefix}. Please try again.`;

    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (isZodIssueArray(parsed)) {
        const details = parsed
          .map((issue) => issue.message)
          .filter(Boolean)
          .join(" ");
        return details ? `${prefix}: ${details}` : `${prefix}. Please check your file and try again.`;
      }
    } catch {
      // not JSON — use message as-is
    }

    if (trimmed.toLowerCase().includes("network") || trimmed.toLowerCase().includes("fetch")) {
      return `${prefix}: network error. Check your connection and try again.`;
    }

    return context === "transcription" && !trimmed.toLowerCase().startsWith("transcription")
      ? `${prefix}: ${trimmed}`
      : trimmed;
  }

  return `${prefix}. Please try again.`;
}

/** Normalize multipart uploads from browsers and Cloudflare Workers (File or Blob). */
export function normalizeUploadFile(
  entry: FormDataEntryValue | null,
  fallbackName: string,
): File | null {
  if (!(entry instanceof Blob) || entry.size === 0) {
    return null;
  }

  if (entry instanceof File && entry.name.trim()) {
    return entry;
  }

  const type = entry.type || "audio/webm";
  return new File([entry], fallbackName, { type });
}

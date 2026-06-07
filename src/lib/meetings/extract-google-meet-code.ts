const GOOGLE_MEET_CODE_PATTERN = /meet\.google\.com\/([a-z]{3}-[a-z]{4}-[a-z]{3})/i;

export function extractGoogleMeetCode(url: string | null | undefined): string | null {
  if (!url?.trim()) return null;

  const match = url.trim().match(GOOGLE_MEET_CODE_PATTERN);
  return match?.[1]?.toLowerCase() ?? null;
}

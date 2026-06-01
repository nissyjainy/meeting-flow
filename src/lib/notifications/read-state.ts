const STORAGE_KEY = "northstar-notification-read-ids";

export function readNotificationReadIds(): Set<string> {
  if (typeof window === "undefined") return new Set();

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();

    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();

    return new Set(parsed.filter((id): id is string => typeof id === "string"));
  } catch {
    return new Set();
  }
}

export function persistNotificationReadIds(readIds: Set<string>): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...readIds]));
  } catch {
    // Ignore quota or privacy mode errors.
  }
}

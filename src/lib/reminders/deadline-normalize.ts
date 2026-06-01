import {
  addDays,
  addWeeks,
  getDay,
  isValid,
  parseISO,
  startOfDay,
  startOfWeek,
  subDays,
} from "date-fns";

export type DeadlineParseSource = "empty" | "iso" | "absolute" | "relative" | "unparsed";

export type DeadlineParseResult = {
  date: Date | null;
  source: DeadlineParseSource;
  normalizedPhrase?: string;
};

const WEEKDAY_NAMES =
  "monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun";

const WEEKDAY_TO_INDEX: Record<string, number> = {
  sunday: 0,
  sun: 0,
  monday: 1,
  mon: 1,
  tuesday: 2,
  tue: 2,
  tues: 2,
  wednesday: 3,
  wed: 3,
  thursday: 4,
  thu: 4,
  thur: 4,
  thurs: 4,
  friday: 5,
  fri: 5,
  saturday: 6,
  sat: 6,
};

function stripDeadlinePrefix(value: string): string {
  return value.replace(/^(by|on|due|before|until|at)\s+/i, "").trim();
}

function sanitizeDeadlineInput(value: string): string {
  return stripDeadlinePrefix(value.trim())
    .replace(/\s+/g, " ")
    .replace(/[.,;:!?)]+$/g, "")
    .trim();
}

function weekdayIndex(name: string): number | null {
  return WEEKDAY_TO_INDEX[name.toLowerCase()] ?? null;
}

function upcomingWeekday(reference: Date, targetDayIndex: number, forceNextWeek = false): Date {
  const today = startOfDay(reference);
  const currentDay = getDay(today);

  if (forceNextWeek) {
    let daysUntil = (targetDayIndex - currentDay + 7) % 7;
    if (daysUntil === 0) daysUntil = 7;
    return addDays(today, daysUntil);
  }

  const daysUntil = (targetDayIndex - currentDay + 7) % 7;
  return addDays(today, daysUntil);
}

function parseRelativeDeadlinePhrase(phrase: string, reference: Date): Date | null {
  const normalized = sanitizeDeadlineInput(phrase).toLowerCase();
  if (!normalized) return null;

  const today = startOfDay(reference);

  if (/^(today|tonight|eod|end of day)$/.test(normalized) || /\btoday\b/.test(normalized)) {
    return today;
  }

  if (/^tomorrow$/.test(normalized) || /\btomorrow\b/.test(normalized)) {
    return addDays(today, 1);
  }

  if (/^yesterday$/.test(normalized) || /\byesterday\b/.test(normalized)) {
    return subDays(today, 1);
  }

  if (/^next week$/.test(normalized) || /\bnext week\b/.test(normalized)) {
    return addDays(today, 7);
  }

  const inDaysMatch = normalized.match(/\bin (\d+) days?\b/);
  if (inDaysMatch) {
    return addDays(today, Number.parseInt(inDaysMatch[1], 10));
  }

  const nextWeekdayMatch = normalized.match(
    new RegExp(`\\bnext (${WEEKDAY_NAMES})\\b`, "i"),
  );
  if (nextWeekdayMatch) {
    const dayIndex = weekdayIndex(nextWeekdayMatch[1]);
    if (dayIndex != null) {
      return upcomingWeekday(reference, dayIndex, true);
    }
  }

  const weekdayOnlyMatch = normalized.match(new RegExp(`^(${WEEKDAY_NAMES})$`, "i"));
  if (weekdayOnlyMatch) {
    const dayIndex = weekdayIndex(weekdayOnlyMatch[1]);
    if (dayIndex != null) {
      return upcomingWeekday(reference, dayIndex, false);
    }
  }

  const weekdayWordMatch = normalized.match(new RegExp(`\\b(${WEEKDAY_NAMES})\\b`, "i"));
  if (weekdayWordMatch && normalized.split(/\s+/).length <= 3) {
    const dayIndex = weekdayIndex(weekdayWordMatch[1]);
    if (dayIndex != null) {
      return upcomingWeekday(reference, dayIndex, false);
    }
  }

  if (normalized.includes("next week")) {
    return addWeeks(startOfWeek(today, { weekStartsOn: 1 }), 1);
  }

  return null;
}

function parseIsoDeadline(trimmed: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return null;
  const iso = parseISO(trimmed.slice(0, 10));
  return isValid(iso) ? startOfDay(iso) : null;
}

function parseStrictAbsoluteDeadline(trimmed: string): Date | null {
  const iso = parseIsoDeadline(trimmed);
  if (iso) return iso;

  const slashMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const [, month, day, year] = slashMatch;
    const parsed = parseISO(`${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`);
    return isValid(parsed) ? startOfDay(parsed) : null;
  }

  return null;
}

export function resolveDeadlineDate(
  deadline: string | null | undefined,
  referenceDate: Date = new Date(),
): DeadlineParseResult {
  if (!deadline?.trim()) {
    return { date: null, source: "empty" };
  }

  const trimmed = deadline.trim();
  const sanitized = sanitizeDeadlineInput(trimmed);

  const iso = parseIsoDeadline(trimmed);
  if (iso) {
    return { date: iso, source: "iso" };
  }

  const relative = parseRelativeDeadlinePhrase(trimmed, referenceDate);
  if (relative) {
    return {
      date: relative,
      source: "relative",
      normalizedPhrase: sanitized.toLowerCase(),
    };
  }

  const absolute = parseStrictAbsoluteDeadline(trimmed);
  if (absolute) {
    return { date: absolute, source: "absolute" };
  }

  return { date: null, source: "unparsed", normalizedPhrase: sanitized.toLowerCase() };
}

/** Backward-compatible helper used by email formatting and classification. */
export function parseDeadlineDate(deadline: string | null): Date | null {
  return resolveDeadlineDate(deadline).date;
}

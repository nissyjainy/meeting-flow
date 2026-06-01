import type { ClassifiedReminderTasks, ReminderCategory } from "./task-reminder-types";

export type ReminderSectionMeta = {
  category: ReminderCategory;
  title: string;
  badgeLabel: string;
  description: string;
  tone: string;
  badgeBg: string;
  badgeText: string;
};

export const REMINDER_SECTIONS: ReminderSectionMeta[] = [
  {
    category: "overdue",
    title: "Overdue",
    badgeLabel: "OVERDUE",
    description: "Past deadline — please follow up",
    tone: "#b91c1c",
    badgeBg: "#fef2f2",
    badgeText: "#991b1b",
  },
  {
    category: "sameDay",
    title: "Due today",
    badgeLabel: "DUE TODAY",
    description: "Deadline is today",
    tone: "#c2410c",
    badgeBg: "#fff7ed",
    badgeText: "#c2410c",
  },
  {
    category: "upcoming",
    title: "Upcoming",
    badgeLabel: "UPCOMING",
    description: "Due within the reminder window",
    tone: "#b45309",
    badgeBg: "#fffbeb",
    badgeText: "#b45309",
  },
  {
    category: "pending",
    title: "Pending",
    badgeLabel: "PENDING",
    description: "Open items without an urgent deadline",
    tone: "#1d4ed8",
    badgeBg: "#eff6ff",
    badgeText: "#1d4ed8",
  },
];

export function getReminderSectionMeta(category: ReminderCategory): ReminderSectionMeta {
  return REMINDER_SECTIONS.find((section) => section.category === category)!;
}

export function countClassifiedTasks(classified: ClassifiedReminderTasks) {
  return {
    overdue: classified.overdue.length,
    sameDay: classified.sameDay.length,
    upcoming: classified.upcoming.length,
    pending: classified.pending.length,
  };
}

export function buildReminderSummary(classified: ClassifiedReminderTasks): string | null {
  const counts = countClassifiedTasks(classified);
  const parts: string[] = [];

  if (counts.overdue > 0) parts.push(`${counts.overdue} overdue`);
  if (counts.sameDay > 0) parts.push(`${counts.sameDay} due today`);
  if (counts.upcoming > 0) parts.push(`${counts.upcoming} upcoming`);
  if (counts.pending > 0) parts.push(`${counts.pending} pending`);

  if (parts.length === 0) return null;

  const total = counts.overdue + counts.sameDay + counts.upcoming + counts.pending;
  if (parts.length === 1) {
    return `You have ${parts[0]} action item${total === 1 ? "" : "s"}.`;
  }

  const last = parts.pop();
  return `You have ${parts.join(", ")}, and ${last} action items.`;
}

export const AUTOMATIC_REMINDER_CATEGORIES: ReminderCategory[] = [
  "overdue",
  "sameDay",
  "upcoming",
];

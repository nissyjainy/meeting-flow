import type { AppNotification } from "./types";

export type NotificationTab = "all" | "unread";

export type NotificationCategory =
  | "tasks_completed"
  | "tasks_updated"
  | "reminder_sends"
  | "meeting_events";

export type DateBucket = "today" | "yesterday" | "earlier";

export type TodayNotificationSummary = Record<NotificationCategory, number>;

export type NotificationGroupRow = {
  kind: "group";
  id: string;
  title: string;
  items: AppNotification[];
  dateBucket: DateBucket;
  latestOccurredAt: string;
  time: string;
  unread: boolean;
};

export type NotificationSingleRow = {
  kind: "single";
  item: AppNotification;
  dateBucket: DateBucket;
};

export type NotificationRow = NotificationGroupRow | NotificationSingleRow;

export type NotificationSection = {
  dateBucket: DateBucket;
  label: string;
  rows: NotificationRow[];
};

const DATE_BUCKET_LABELS: Record<DateBucket, string> = {
  today: "Today",
  yesterday: "Yesterday",
  earlier: "Earlier",
};

const CATEGORY_BY_TITLE: Record<string, NotificationCategory> = {
  "Task completed": "tasks_completed",
  "Task updated": "tasks_updated",
  "Reminder sent": "reminder_sends",
  "AI summary ready": "meeting_events",
  "Processing failed": "meeting_events",
  "Action items extracted": "meeting_events",
};

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function getDateBucket(iso: string, referenceDate = new Date()): DateBucket {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "earlier";

  const todayStart = startOfLocalDay(referenceDate);
  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);

  const eventDay = startOfLocalDay(date);

  if (eventDay.getTime() === todayStart.getTime()) return "today";
  if (eventDay.getTime() === yesterdayStart.getTime()) return "yesterday";
  return "earlier";
}

export function getNotificationCategory(notification: AppNotification): NotificationCategory | null {
  return CATEGORY_BY_TITLE[notification.title] ?? null;
}

export function filterNotificationsByTab(
  notifications: AppNotification[],
  tab: NotificationTab,
): AppNotification[] {
  if (tab === "unread") {
    return notifications.filter((notification) => !notification.read);
  }
  return notifications;
}

export function buildTodaySummary(
  notifications: AppNotification[],
  referenceDate = new Date(),
): TodayNotificationSummary {
  const summary: TodayNotificationSummary = {
    tasks_completed: 0,
    tasks_updated: 0,
    reminder_sends: 0,
    meeting_events: 0,
  };

  for (const notification of notifications) {
    if (getDateBucket(notification.occurredAt, referenceDate) !== "today") continue;

    const category = getNotificationCategory(notification);
    if (category) {
      summary[category] += 1;
    }
  }

  return summary;
}

function groupTitleLabel(title: string, count: number): string {
  switch (title) {
    case "Task completed":
      return `${count} Task${count === 1 ? "" : "s"} Completed`;
    case "Task updated":
      return `${count} Task${count === 1 ? "" : "s"} Updated`;
    case "Reminder sent":
      return `${count} Reminder${count === 1 ? "" : "s"} Sent`;
    case "Action items extracted":
      return `${count} Action Item${count === 1 ? "" : "s"} Extracted`;
    case "AI summary ready":
      return `${count} Meeting Summar${count === 1 ? "y" : "ies"} Ready`;
    case "Processing failed":
      return `${count} Processing Failed`;
    default:
      return count === 1 ? title : `${count} ${title}`;
  }
}

function buildRowsForBucket(
  notifications: AppNotification[],
  dateBucket: DateBucket,
  referenceDate = new Date(),
): NotificationRow[] {
  const bucketItems = notifications.filter(
    (notification) => getDateBucket(notification.occurredAt, referenceDate) === dateBucket,
  );

  const groups = new Map<string, AppNotification[]>();

  for (const notification of bucketItems) {
    const key = notification.title;
    const existing = groups.get(key) ?? [];
    existing.push(notification);
    groups.set(key, existing);
  }

  const rows: NotificationRow[] = [];

  for (const [title, items] of groups) {
    const sortedItems = [...items].sort(
      (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
    );

    if (sortedItems.length === 1) {
      rows.push({
        kind: "single",
        item: sortedItems[0]!,
        dateBucket,
      });
      continue;
    }

    const latest = sortedItems[0]!;
    rows.push({
      kind: "group",
      id: `${dateBucket}:${title}`,
      title: groupTitleLabel(title, sortedItems.length),
      items: sortedItems,
      dateBucket,
      latestOccurredAt: latest.occurredAt,
      time: latest.time,
      unread: sortedItems.some((item) => !item.read),
    });
  }

  return rows.sort(
    (a, b) =>
      getRowTimestamp(b).getTime() - getRowTimestamp(a).getTime(),
  );
}

function getRowTimestamp(row: NotificationRow): Date {
  if (row.kind === "single") {
    return new Date(row.item.occurredAt);
  }
  return new Date(row.latestOccurredAt);
}

export function buildNotificationSections(
  notifications: AppNotification[],
  referenceDate = new Date(),
): NotificationSection[] {
  const buckets: DateBucket[] = ["today", "yesterday", "earlier"];

  return buckets
    .map((dateBucket) => ({
      dateBucket,
      label: DATE_BUCKET_LABELS[dateBucket],
      rows: buildRowsForBucket(notifications, dateBucket, referenceDate),
    }))
    .filter((section) => section.rows.length > 0);
}

export function flattenNotificationSections(sections: NotificationSection[]): NotificationRow[] {
  return sections.flatMap((section) => section.rows);
}

export function paginateNotificationRows(
  rows: NotificationRow[],
  visibleCount: number,
): { visibleRows: NotificationRow[]; hasMore: boolean; totalCount: number } {
  const safeCount = Math.max(0, visibleCount);
  return {
    visibleRows: rows.slice(0, safeCount),
    hasMore: rows.length > safeCount,
    totalCount: rows.length,
  };
}

export function sliceNotificationSections(
  sections: NotificationSection[],
  visibleCount: number,
): { sections: NotificationSection[]; hasMore: boolean; totalCount: number } {
  const flatRows = flattenNotificationSections(sections);
  const { visibleRows, hasMore, totalCount } = paginateNotificationRows(flatRows, visibleCount);

  const visibleSet = new Set(visibleRows);
  const nextSections: NotificationSection[] = [];

  for (const section of sections) {
    const rows = section.rows.filter((row) => visibleSet.has(row));
    if (rows.length > 0) {
      nextSections.push({ ...section, rows });
    }
  }

  return {
    sections: nextSections,
    hasMore,
    totalCount,
  };
}

export function getRowNotificationIds(row: NotificationRow): string[] {
  if (row.kind === "single") {
    return [row.item.id];
  }
  return row.items.map((item) => item.id);
}

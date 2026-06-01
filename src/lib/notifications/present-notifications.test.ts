import { describe, expect, it } from "vitest";
import type { AppNotification } from "./types";
import {
  buildNotificationSections,
  buildTodaySummary,
  filterNotificationsByTab,
  paginateNotificationRows,
  sliceNotificationSections,
} from "./present-notifications";

const referenceDate = new Date(2026, 4, 28, 15, 0, 0);

function notification(partial: Partial<AppNotification> & Pick<AppNotification, "id" | "title">): AppNotification {
  return {
    type: "task",
    description: partial.description ?? partial.title,
    occurredAt: partial.occurredAt ?? new Date(2026, 4, 28, 10, 0, 0).toISOString(),
    time: partial.time ?? "5h ago",
    read: partial.read ?? false,
    ...partial,
  };
}

describe("present-notifications", () => {
  it("builds today summary counts by category", () => {
    const items = [
      notification({
        id: "1",
        title: "Task completed",
        occurredAt: new Date(2026, 4, 28, 9, 0, 0).toISOString(),
      }),
      notification({
        id: "2",
        title: "Task completed",
        occurredAt: new Date(2026, 4, 28, 8, 0, 0).toISOString(),
      }),
      notification({
        id: "3",
        title: "Task updated",
        occurredAt: new Date(2026, 4, 28, 7, 0, 0).toISOString(),
      }),
      notification({
        id: "4",
        title: "Reminder sent",
        occurredAt: new Date(2026, 4, 27, 7, 0, 0).toISOString(),
      }),
    ];

    expect(buildTodaySummary(items, referenceDate)).toEqual({
      tasks_completed: 2,
      tasks_updated: 1,
      reminder_sends: 0,
      meeting_events: 0,
    });
  });

  it("groups repeated titles within a date bucket", () => {
    const items = [
      notification({ id: "1", title: "Task completed", description: "Task A" }),
      notification({ id: "2", title: "Task completed", description: "Task B" }),
      notification({ id: "3", title: "Reminder sent", description: "Digest email" }),
    ];

    const sections = buildNotificationSections(items, referenceDate);
    const today = sections.find((section) => section.dateBucket === "today");

    expect(today?.rows).toHaveLength(2);
    expect(today?.rows[0]?.kind).toBe("group");
    if (today?.rows[0]?.kind === "group") {
      expect(today.rows[0].title).toBe("2 Tasks Completed");
      expect(today.rows[0].items).toHaveLength(2);
    }
  });

  it("filters unread tab and paginates rows", () => {
    const items = Array.from({ length: 12 }, (_, index) =>
      notification({
        id: `n-${index}`,
        title: `AI summary ready ${index}`,
        description: `Meeting ${index}`,
        read: index > 0,
      }),
    );

    const unread = filterNotificationsByTab(items, "unread");
    expect(unread).toHaveLength(1);

    const sections = buildNotificationSections(items, referenceDate);
    const flat = sections.flatMap((section) => section.rows);
    expect(flat).toHaveLength(12);

    const page = paginateNotificationRows(flat, 10);
    expect(page.visibleRows).toHaveLength(10);
    expect(page.hasMore).toBe(true);

    const sliced = sliceNotificationSections(sections, 10);
    expect(sliced.totalCount).toBe(12);
    expect(sliced.hasMore).toBe(true);
  });
});

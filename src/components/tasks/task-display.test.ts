import { describe, expect, it, vi } from "vitest";
import type { MeetingTaskRecord } from "@/lib/meetings/types";
import {
  kanbanColumnToStoredStatus,
  logTaskFilterDebug,
  resolveTaskDisplayStatus,
  taskDisplayStatusLabel,
  taskMatchesKanbanColumn,
  taskMatchesStatusFilter,
  taskStoredStatus,
} from "./task-display";

const baseTask: MeetingTaskRecord = {
  id: "task-test",
  meeting_id: "meeting-test",
  task: "Test task",
  owner: "Nisarg",
  deadline: "2026-01-01",
  status: "pending",
  created_at: "2026-05-20T10:00:00.000Z",
  updated_at: "2026-05-20T10:00:00.000Z",
  started_at: null,
  completed_at: null,
};

describe("task-display", () => {
  it("maps stored statuses to kanban columns", () => {
    expect(taskMatchesKanbanColumn({ ...baseTask, status: "pending" }, "todo")).toBe(true);
    expect(taskMatchesKanbanColumn({ ...baseTask, status: "in_progress" }, "in-progress")).toBe(
      true,
    );
    expect(taskMatchesKanbanColumn({ ...baseTask, status: "completed" }, "done")).toBe(true);
  });

  it("normalizes legacy open status for filters", () => {
    expect(taskStoredStatus({ ...baseTask, status: "open" as MeetingTaskRecord["status"] })).toBe(
      "pending",
    );
    expect(taskMatchesStatusFilter({ ...baseTask, status: "open" as MeetingTaskRecord["status"] }, "todo")).toBe(
      true,
    );
    expect(taskMatchesStatusFilter({ ...baseTask, status: "open" as MeetingTaskRecord["status"] }, "done")).toBe(
      false,
    );
  });

  it("filters tasks by status tab", () => {
    const tasks: MeetingTaskRecord[] = [
      { ...baseTask, id: "1", status: "pending" },
      { ...baseTask, id: "2", status: "in_progress" },
      { ...baseTask, id: "3", status: "completed" },
    ];

    expect(tasks.filter((task) => taskMatchesStatusFilter(task, "all"))).toHaveLength(3);
    expect(tasks.filter((task) => taskMatchesStatusFilter(task, "todo"))).toHaveLength(1);
    expect(tasks.filter((task) => taskMatchesStatusFilter(task, "in-progress"))).toHaveLength(1);
    expect(tasks.filter((task) => taskMatchesStatusFilter(task, "done"))).toHaveLength(1);
  });

  it("maps kanban columns to stored statuses for drag-drop", () => {
    expect(kanbanColumnToStoredStatus("todo")).toBe("pending");
    expect(kanbanColumnToStoredStatus("in-progress")).toBe("in_progress");
    expect(kanbanColumnToStoredStatus("done")).toBe("completed");
  });

  it("shows overdue when deadline is in the past", () => {
    expect(resolveTaskDisplayStatus({ ...baseTask, deadline: "2020-01-01" })).toBe("overdue");
    expect(taskDisplayStatusLabel({ ...baseTask, deadline: "2020-01-01" })).toBe("Overdue");
  });

  it("does not mark completed tasks as overdue", () => {
    expect(
      resolveTaskDisplayStatus({
        ...baseTask,
        status: "completed",
        deadline: "2020-01-01",
      }),
    ).toBe("completed");
  });

  it("logs filter diagnostics", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    logTaskFilterDebug("todo", [{ ...baseTask }], [{ ...baseTask }]);
    expect(info).toHaveBeenCalledWith(
      "[tasks-filter]",
      expect.objectContaining({
        filter: "todo",
        expectedStoredStatus: "pending",
        filteredCount: 1,
      }),
    );
    info.mockRestore();
  });
});

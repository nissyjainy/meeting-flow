import type { SupabaseClient } from "@supabase/supabase-js";
import { endOfDay, format, startOfDay, subDays } from "date-fns";
import {
  isTaskCompletedStatus,
  isTaskOverdue,
} from "@/lib/meetings/task-status";
import { mapMeetingTaskRow, TASK_COLUMNS } from "@/lib/meetings/task-record";
import type { MeetingTaskRecord } from "@/lib/meetings/types";
import {
  fileExtensionLabel,
  formatMeetingDate,
  titleFromFileName,
} from "@/lib/meetings/validation";
import type {
  DashboardAnalytics,
  DashboardMeetingSummary,
  WeeklyActivityPoint,
} from "./analytics-types";
import { computeExecutionMetrics } from "./execution-metrics";

export const DASHBOARD_MEETING_COLUMNS =
  "id,file_name,summary,status,created_at,transcript";

export type DashboardMeetingRow = {
  id: string;
  file_name: string | null;
  summary: string | null;
  status: string | null;
  created_at: string | null;
  transcript: string | null;
};

function emptyWeeklyActivity(referenceDate = new Date()): WeeklyActivityPoint[] {
  return Array.from({ length: 7 }, (_, index) => ({
    day: format(startOfDay(subDays(referenceDate, 6 - index)), "EEE"),
    meetings: 0,
    tasks: 0,
  }));
}

export function mapDashboardMeetingStatus(
  row: DashboardMeetingRow,
): DashboardMeetingSummary["status"] {
  if (row.status === "failed") return "failed";
  if (row.summary?.trim() && row.transcript?.trim()) return "ready";
  if (row.status === "completed" || row.status === "ready") return "ready";
  return "processing";
}

function buildWeeklyActivity(
  meetings: DashboardMeetingRow[],
  tasks: MeetingTaskRecord[],
  referenceDate = new Date(),
): WeeklyActivityPoint[] {
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = startOfDay(subDays(referenceDate, 6 - index));
    return {
      day: format(date, "EEE"),
      start: date,
      end: endOfDay(date),
    };
  });

  return days.map(({ day, start, end }) => {
    const meetingsCount = meetings.filter((row) => {
      if (!row.created_at) return false;
      const created = new Date(row.created_at);
      return !Number.isNaN(created.getTime()) && created >= start && created <= end;
    }).length;

    const tasksCount = tasks.filter((row) => {
      if (!row.created_at) return false;
      const created = new Date(row.created_at);
      return !Number.isNaN(created.getTime()) && created >= start && created <= end;
    }).length;

    return { day, meetings: meetingsCount, tasks: tasksCount };
  });
}

export function computeDashboardTaskStats(tasks: MeetingTaskRecord[]) {
  let pendingTasks = 0;
  let overdueTasks = 0;
  let completedTasks = 0;

  for (const task of tasks) {
    if (isTaskCompletedStatus(task.status)) {
      completedTasks += 1;
      continue;
    }

    if (isTaskOverdue(task.deadline)) {
      overdueTasks += 1;
      continue;
    }

    pendingTasks += 1;
  }

  return { pendingTasks, overdueTasks, completedTasks };
}

function buildRecentMeetings(
  meetings: DashboardMeetingRow[],
  taskCountByMeeting: Map<string, number>,
): DashboardMeetingSummary[] {
  return meetings
    .filter((row) => mapDashboardMeetingStatus(row) === "ready")
    .slice(0, 4)
    .map((row) => ({
      id: row.id,
      title: titleFromFileName(row.file_name ?? "Untitled meeting"),
      date: row.created_at ? formatMeetingDate(row.created_at) : "Unknown date",
      summary: row.summary?.trim() || null,
      recordingType: fileExtensionLabel(row.file_name ?? ""),
      actionItems: taskCountByMeeting.get(row.id) ?? 0,
      status: mapDashboardMeetingStatus(row),
    }));
}

function mapTaskRows(rows: Record<string, unknown>[]): MeetingTaskRecord[] {
  return rows
    .map((row) => mapMeetingTaskRow(row))
    .filter((row): row is MeetingTaskRecord => row !== null);
}

export async function fetchDashboardMeetingRows(
  supabase: SupabaseClient,
): Promise<DashboardMeetingRow[]> {
  const { data, error } = await supabase
    .from("meetings")
    .select(DASHBOARD_MEETING_COLUMNS)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[dashboard-dataset] meetings query failed", {
      columns: DASHBOARD_MEETING_COLUMNS,
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
    });
    return [];
  }

  const rows = (data ?? []) as DashboardMeetingRow[];
  console.info("[dashboard-dataset] meetings query success", { count: rows.length });
  return rows;
}

export async function fetchDashboardTaskRows(
  supabase: SupabaseClient,
): Promise<MeetingTaskRecord[]> {
  const { data, error } = await supabase
    .from("tasks")
    .select(TASK_COLUMNS)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[dashboard-dataset] tasks query failed", {
      columns: TASK_COLUMNS,
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
    });
    return [];
  }

  const rows = mapTaskRows((data ?? []) as Record<string, unknown>[]);
  console.info("[dashboard-dataset] tasks query success", {
    rawCount: data?.length ?? 0,
    mappedCount: rows.length,
  });
  return rows;
}

export async function countDashboardReminderSends(
  supabase: SupabaseClient,
): Promise<number> {
  const { count, error } = await supabase
    .from("reminder_sends")
    .select("id", { count: "exact", head: true });

  if (error) {
    console.warn("[dashboard-dataset] reminder_sends count failed (using 0)", {
      message: error.message,
      code: error.code,
    });
    return 0;
  }

  console.info("[dashboard-dataset] reminder_sends count success", { count: count ?? 0 });
  return count ?? 0;
}

export function buildDashboardAnalyticsFromDataset(
  meetings: DashboardMeetingRow[],
  tasks: MeetingTaskRecord[],
  remindersSent: number,
  referenceDate = new Date(),
): DashboardAnalytics {
  const taskCountByMeeting = new Map<string, number>();
  for (const task of tasks) {
    taskCountByMeeting.set(task.meeting_id, (taskCountByMeeting.get(task.meeting_id) ?? 0) + 1);
  }

  const { pendingTasks, overdueTasks, completedTasks } = computeDashboardTaskStats(tasks);
  const { execution, topPriorities } = computeExecutionMetrics(tasks, referenceDate);

  return {
    totalMeetings: meetings.length,
    pendingTasks,
    overdueTasks,
    completedTasks,
    remindersSent,
    execution,
    topPriorities,
    weeklyActivity: buildWeeklyActivity(meetings, tasks, referenceDate),
    recentMeetings: buildRecentMeetings(meetings, taskCountByMeeting),
  };
}

export function emptyDashboardAnalytics(referenceDate = new Date()): DashboardAnalytics {
  return {
    totalMeetings: 0,
    pendingTasks: 0,
    overdueTasks: 0,
    completedTasks: 0,
    remindersSent: 0,
    execution: {
      totalOpen: 0,
      overdue: 0,
      dueToday: 0,
      completedThisWeek: 0,
    },
    topPriorities: [],
    weeklyActivity: emptyWeeklyActivity(referenceDate),
    recentMeetings: [],
  };
}

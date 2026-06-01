import type { SupabaseClient } from "@supabase/supabase-js";
import {
  mapTaskStatusEventRow,
  TASK_STATUS_EVENT_COLUMNS,
  type TaskStatusEventRecord,
} from "@/lib/analytics/task-status-event-record";
import { computeExecutionHealthBundle } from "@/lib/execution-health/execution-health";
import {
  fetchDashboardMeetingRows,
  fetchDashboardTaskRows,
  countDashboardReminderSends,
  computeDashboardTaskStats,
  type DashboardMeetingRow,
} from "@/lib/dashboard/dashboard-dataset.server";
import { getPipelineDisplayStatus } from "@/lib/meetings/meeting-display";
import { enrichMeetingRecord } from "@/lib/meetings/record";
import { resolveDisplayTaskStatus } from "@/lib/meetings/task-status";
import type { MeetingTaskRecord } from "@/lib/meetings/types";
import { titleFromFileName } from "@/lib/meetings/validation";
import {
  findTeamMemberEmailForOwner,
} from "@/lib/reminders/owner-email-mapping.server";
import { buildMeetingReference, fetchTeamMembersForMeetings } from "@/lib/reminders/task-reminder-data.server";
import { getReminderConfig } from "@/lib/reminders/reminder-env";
import type { TeamMemberRecord } from "@/lib/reminders/task-reminder-types";
import { enrichTaskReminderCategories } from "./format-response";
import { computeCopilotAdvancedInsights } from "./copilot-advanced-insights";
import type {
  CopilotMeetingSummary,
  CopilotReminderHistoryEntry,
  CopilotTaskContext,
  CopilotWorkspaceContext,
} from "./types";

export const COPILOT_MEETING_COLUMNS =
  "id,file_name,file_url,transcript,summary,status,created_at";

export const COPILOT_REMINDER_HISTORY_LIMIT = 50;

type CopilotMeetingRow = {
  id: string;
  file_name: string | null;
  file_url: string | null;
  transcript: string | null;
  summary: string | null;
  status: string | null;
  created_at: string;
};

type ReminderSendRow = {
  id: string;
  meeting_id: string | null;
  recipient: string;
  subject: string | null;
  sent_at: string;
};

function logCopilotWorkspace(message: string, details?: Record<string, unknown>): void {
  if (details) {
    console.info(`[copilot-workspace] ${message}`, details);
  } else {
    console.info(`[copilot-workspace] ${message}`);
  }
}

function mapPipelineStatus(
  meeting: ReturnType<typeof enrichMeetingRecord>,
): CopilotMeetingSummary["pipelineStatus"] {
  const pipeline = getPipelineDisplayStatus(meeting);
  if (pipeline === "completed") return "ready";
  return pipeline;
}

function meetingTitleById(
  meetingRows: CopilotMeetingRow[],
  meetingId: string | null,
): string {
  if (!meetingId) return "Unknown meeting";
  const row = meetingRows.find((meeting) => meeting.id === meetingId);
  return row ? titleFromFileName(row.file_name ?? "Untitled meeting") : "Unknown meeting";
}

export function buildCopilotMeetingSummaries(
  meetingRows: CopilotMeetingRow[],
  taskCountByMeeting: Map<string, number>,
): CopilotMeetingSummary[] {
  return meetingRows.map((row) => {
    const meeting = enrichMeetingRecord(row);
    return {
      meetingId: meeting.id,
      meetingTitle: titleFromFileName(meeting.file_name),
      summary: meeting.summary,
      pipelineStatus: mapPipelineStatus(meeting),
      createdAt: meeting.created_at,
      taskCount: taskCountByMeeting.get(meeting.id) ?? 0,
    };
  });
}

export function mapCopilotWorkspaceTasks(
  tasks: MeetingTaskRecord[],
  meetingRows: CopilotMeetingRow[],
  membersByMeeting: Map<string, TeamMemberRecord[]>,
  appUrl: string,
): CopilotTaskContext[] {
  const titleByMeetingId = new Map(
    meetingRows.map((row) => [row.id, titleFromFileName(row.file_name ?? "Untitled meeting")]),
  );

  const mapped: CopilotTaskContext[] = [];

  for (const row of tasks) {
    const members = membersByMeeting.get(row.meeting_id) ?? [];
    const meetingRow = meetingRows.find((meeting) => meeting.id === row.meeting_id);
    if (!meetingRow) continue;

    const meetingRef = buildMeetingReference(
      {
        id: meetingRow.id,
        file_name: meetingRow.file_name ?? "",
        created_at: meetingRow.created_at,
      },
      appUrl,
    );

    const baseTask: CopilotTaskContext = {
      id: row.id,
      meetingId: row.meeting_id,
      meetingTitle: titleByMeetingId.get(row.meeting_id) ?? "Unknown meeting",
      task: row.task,
      owner: row.owner,
      ownerEmail: findTeamMemberEmailForOwner(row.owner, members),
      deadline: row.deadline,
      storedStatus: row.status,
      status: resolveDisplayTaskStatus(row.status, row.deadline),
      reminderCategory: null,
    };

    mapped.push(...enrichTaskReminderCategories([baseTask], meetingRef));
  }

  return mapped;
}

export function buildCopilotReminderHistoryEntries(
  rows: ReminderSendRow[],
  meetingRows: CopilotMeetingRow[],
): CopilotReminderHistoryEntry[] {
  return rows.map((row) => ({
    id: row.id,
    meetingId: row.meeting_id,
    meetingTitle: meetingTitleById(meetingRows, row.meeting_id),
    recipient: row.recipient,
    subject: row.subject,
    sentAt: row.sent_at,
  }));
}

export function assembleCopilotWorkspaceContext(input: {
  meetingRows: CopilotMeetingRow[];
  dashboardMeetingRows: DashboardMeetingRow[];
  tasks: MeetingTaskRecord[];
  taskStatusEvents: TaskStatusEventRecord[];
  membersByMeeting: Map<string, TeamMemberRecord[]>;
  reminderHistoryRows: ReminderSendRow[];
  remindersSent: number;
  appUrl: string;
  referenceDate?: Date;
}): CopilotWorkspaceContext {
  const referenceDate = input.referenceDate ?? new Date();
  const taskCountByMeeting = new Map<string, number>();
  for (const task of input.tasks) {
    taskCountByMeeting.set(
      task.meeting_id,
      (taskCountByMeeting.get(task.meeting_id) ?? 0) + 1,
    );
  }

  const executionHealth = computeExecutionHealthBundle(
    input.tasks,
    input.taskStatusEvents,
    referenceDate,
  );

  const meetings = buildCopilotMeetingSummaries(input.meetingRows, taskCountByMeeting);
  const tasks = mapCopilotWorkspaceTasks(
    input.tasks,
    input.meetingRows,
    input.membersByMeeting,
    input.appUrl,
  );
  const reminderHistory = buildCopilotReminderHistoryEntries(
    input.reminderHistoryRows,
    input.meetingRows,
  );

  const taskStats = computeDashboardTaskStats(input.tasks);
  const advancedInsights = computeCopilotAdvancedInsights({
    bundle: executionHealth,
    meetings,
    tasks: input.tasks,
    referenceDate,
  });

  return {
    meetings,
    tasks,
    execution: executionHealth.execution,
    taskStats: {
      pendingTasks: taskStats.pendingTasks,
      overdueTasks: taskStats.overdueTasks,
      completedTasks: taskStats.completedTasks,
    },
    accountability: executionHealth.accountability,
    executionHealth,
    advancedInsights,
    topPriorities: executionHealth.topPriorities,
    remindersSent: input.remindersSent,
    reminderHistory,
  };
}

async function fetchCopilotMeetingRows(
  supabase: SupabaseClient,
): Promise<CopilotMeetingRow[]> {
  const { data, error } = await supabase
    .from("meetings")
    .select(COPILOT_MEETING_COLUMNS)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[copilot-workspace] meetings query failed", {
      columns: COPILOT_MEETING_COLUMNS,
      message: error.message,
      code: error.code,
    });
    throw new Error(error.message);
  }

  const rows = (data ?? []) as CopilotMeetingRow[];
  logCopilotWorkspace("meetings loaded", { count: rows.length });
  return rows;
}

async function fetchCopilotTaskStatusEventRows(
  supabase: SupabaseClient,
): Promise<TaskStatusEventRecord[]> {
  const { data, error } = await supabase
    .from("task_status_events")
    .select(TASK_STATUS_EVENT_COLUMNS)
    .order("occurred_at", { ascending: true });

  if (error) {
    console.error("[copilot-workspace] task status events query failed", {
      message: error.message,
      code: error.code,
    });
    return [];
  }

  const rows = (data ?? [])
    .map((row) => mapTaskStatusEventRow(row as Record<string, unknown>))
    .filter((row): row is TaskStatusEventRecord => row !== null);

  logCopilotWorkspace("task status events loaded", { count: rows.length });
  return rows;
}

async function fetchCopilotReminderHistoryRows(
  supabase: SupabaseClient,
  limit = COPILOT_REMINDER_HISTORY_LIMIT,
): Promise<ReminderSendRow[]> {
  const { data, error } = await supabase
    .from("reminder_sends")
    .select("id,meeting_id,recipient,subject,sent_at")
    .order("sent_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[copilot-workspace] reminder history query failed", {
      message: error.message,
      code: error.code,
    });
    return [];
  }

  const rows = (data ?? []) as ReminderSendRow[];
  logCopilotWorkspace("reminder history loaded", { count: rows.length, limit });
  return rows;
}

export async function loadCopilotWorkspaceContext(
  supabase: SupabaseClient,
): Promise<CopilotWorkspaceContext> {
  logCopilotWorkspace("load start");

  const { appUrl } = getReminderConfig();

  const [meetingRows, dashboardMeetingRows, tasks, taskStatusEvents, remindersSent, reminderHistoryRows] =
    await Promise.all([
      fetchCopilotMeetingRows(supabase),
      fetchDashboardMeetingRows(supabase),
      fetchDashboardTaskRows(supabase),
      fetchCopilotTaskStatusEventRows(supabase),
      countDashboardReminderSends(supabase),
      fetchCopilotReminderHistoryRows(supabase),
    ]);

  const meetingIds = meetingRows.map((row) => row.id);
  const membersByMeeting = await fetchTeamMembersForMeetings(supabase, meetingIds);

  const context = assembleCopilotWorkspaceContext({
    meetingRows,
    dashboardMeetingRows,
    tasks,
    taskStatusEvents,
    membersByMeeting,
    reminderHistoryRows,
    remindersSent,
    appUrl,
  });

  logCopilotWorkspace("load success", {
    meetings: context.meetings.length,
    tasks: context.tasks.length,
    execution: context.execution,
    taskStats: context.taskStats,
    accountabilityKpis: context.accountability.kpis,
    advancedInsights: Boolean(context.advancedInsights),
    executionHealthScore: context.executionHealth.overview.healthScore,
    topPriorities: context.topPriorities.length,
    remindersSent: context.remindersSent,
    reminderHistory: context.reminderHistory.length,
  });

  return context;
}

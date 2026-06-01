import type { SupabaseClient } from "@supabase/supabase-js";
import { getPipelineDisplayStatus } from "@/lib/meetings/meeting-display";
import { mapMeetingTaskRow, TASK_COLUMNS } from "@/lib/meetings/task-record";
import { resolveDisplayTaskStatus } from "@/lib/meetings/task-status";
import type { MeetingRecord } from "@/lib/meetings/types";
import { enrichMeetingRecord } from "@/lib/meetings/record";
import { titleFromFileName } from "@/lib/meetings/validation";
import { findTeamMemberEmailForOwner } from "@/lib/reminders/owner-email-mapping.server";
import { buildMeetingReference } from "@/lib/reminders/task-reminder-data.server";
import { getReminderConfig } from "@/lib/reminders/reminder-env";
import type { TeamMemberRecord } from "@/lib/reminders/task-reminder-types";
import { enrichTaskReminderCategories } from "./format-response";
import type { CopilotMeetingContext, CopilotTaskContext } from "./types";

export { loadCopilotWorkspaceContext } from "./copilot-workspace.server";

const MEETING_COLUMNS = "id,file_name,file_url,transcript,summary,status,created_at";

async function countRemindersForMeeting(
  supabase: SupabaseClient,
  meetingId: string,
): Promise<number> {
  const { count, error } = await supabase
    .from("reminder_sends")
    .select("id", { count: "exact", head: true })
    .eq("meeting_id", meetingId);

  if (error) return 0;
  return count ?? 0;
}

async function loadTeamMembers(
  supabase: SupabaseClient,
  meetingId: string,
): Promise<TeamMemberRecord[]> {
  const { data, error } = await supabase
    .from("team_members")
    .select("id,name,email")
    .eq("meeting_id", meetingId);

  if (error) return [];

  return (data ?? []).map((row) => ({
    id: String(row.id),
    name: row.name != null ? String(row.name) : "",
    email: row.email != null ? String(row.email) : "",
  }));
}

function mapPipelineStatus(
  meeting: MeetingRecord,
): CopilotMeetingContext["pipelineStatus"] {
  const pipeline = getPipelineDisplayStatus(meeting);
  if (pipeline === "completed") return "ready";
  return pipeline;
}

function mapTasks(
  rows: Record<string, unknown>[],
  members: TeamMemberRecord[],
  meetingRef: ReturnType<typeof buildMeetingReference>,
  meetingId: string,
  meetingTitle: string,
): CopilotTaskContext[] {
  const tasks = rows
    .map((row) => mapMeetingTaskRow(row))
    .filter((row): row is NonNullable<ReturnType<typeof mapMeetingTaskRow>> => row !== null)
    .map((row) => ({
      id: row.id,
      meetingId,
      meetingTitle,
      task: row.task,
      owner: row.owner,
      ownerEmail: findTeamMemberEmailForOwner(row.owner, members),
      deadline: row.deadline,
      storedStatus: row.status,
      status: resolveDisplayTaskStatus(row.status, row.deadline),
      reminderCategory: null as string | null,
    }));

  return enrichTaskReminderCategories(tasks, meetingRef);
}

export async function loadCopilotMeetingContext(
  supabase: SupabaseClient,
  meetingId: string | null,
): Promise<CopilotMeetingContext> {
  const { appUrl } = getReminderConfig();

  let meetingQuery = supabase
    .from("meetings")
    .select(MEETING_COLUMNS)
    .order("created_at", { ascending: false });

  if (meetingId) {
    meetingQuery = meetingQuery.eq("id", meetingId);
  }

  const { data: meetingRows, error: meetingError } = await meetingQuery.limit(1);

  if (meetingError) {
    throw new Error(meetingError.message);
  }

  const meetingRow = meetingRows?.[0];
  if (!meetingRow) {
    return {
      meetingId: null,
      meetingTitle: "No meeting",
      summary: null,
      pipelineStatus: "none",
      tasks: [],
      remindersSent: 0,
    };
  }

  const meeting = enrichMeetingRecord(meetingRow);
  const resolvedMeetingId = meeting.id;
  const meetingTitle = titleFromFileName(meeting.file_name);
  const meetingRef = buildMeetingReference(
    {
      id: meeting.id,
      file_name: meeting.file_name,
      created_at: meeting.created_at,
    },
    appUrl,
  );

  const [tasksResult, members, remindersSent] = await Promise.all([
    supabase
      .from("tasks")
      .select(TASK_COLUMNS)
      .eq("meeting_id", resolvedMeetingId)
      .order("created_at", { ascending: true }),
    loadTeamMembers(supabase, resolvedMeetingId),
    countRemindersForMeeting(supabase, resolvedMeetingId),
  ]);

  if (tasksResult.error) {
    throw new Error(tasksResult.error.message);
  }

  const tasks = mapTasks(
    (tasksResult.data ?? []) as Record<string, unknown>[],
    members,
    meetingRef,
    resolvedMeetingId,
    meetingTitle,
  );

  return {
    meetingId: resolvedMeetingId,
    meetingTitle,
    summary: meeting.summary,
    pipelineStatus: mapPipelineStatus(meeting),
    tasks,
    remindersSent,
  };
}

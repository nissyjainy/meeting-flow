import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeStoredStatus } from "@/lib/meetings/task-status";
import { titleFromFileName } from "@/lib/meetings/validation";
import { mapTeamMemberRows } from "./owner-email-mapping.server";
import { getReminderConfig } from "./reminder-env";
import type { MeetingReference, ReminderTaskItem, ReminderTaskRow, TeamMemberRecord } from "./task-reminder-types";

function mapTaskRow(row: Record<string, unknown>): ReminderTaskRow | null {
  const task = String(row.task ?? row.description ?? "").trim();
  if (!task) return null;

  return {
    id: String(row.id),
    meeting_id: String(row.meeting_id),
    task,
    owner: row.owner != null ? String(row.owner) : null,
    deadline:
      row.deadline != null
        ? String(row.deadline)
        : row.due_date != null
          ? String(row.due_date)
          : null,
    status: normalizeStoredStatus(row.status != null ? String(row.status) : "pending"),
  };
}

export function buildMeetingReference(
  meeting: { id: string; file_name: string; created_at: string },
  appUrl: string,
): MeetingReference {
  return {
    id: meeting.id,
    title: titleFromFileName(meeting.file_name),
    fileName: meeting.file_name,
    createdAt: meeting.created_at,
    url: `${appUrl}/meetings/${meeting.id}`,
  };
}

export function userIdFromMeetingFileUrl(fileUrl: string | null | undefined): string | null {
  if (!fileUrl?.trim()) return null;
  const segment = fileUrl.split("/").filter(Boolean)[0];
  return segment?.trim() || null;
}

export async function fetchMeetingTasks(
  supabase: SupabaseClient,
  meetingId: string,
): Promise<{ meeting: MeetingReference | null; tasks: ReminderTaskRow[] }> {
  const { appUrl } = getReminderConfig();

  const [{ data: meeting, error: meetingError }, { data: tasks, error: tasksError }] =
    await Promise.all([
      supabase
        .from("meetings")
        .select("id,file_name,created_at")
        .eq("id", meetingId)
        .maybeSingle(),
      supabase
        .from("tasks")
        .select("id,meeting_id,task,owner,deadline,status")
        .eq("meeting_id", meetingId)
        .order("created_at", { ascending: true }),
    ]);

  if (meetingError) throw new Error(`Failed to load meeting: ${meetingError.message}`);
  if (tasksError) throw new Error(`Failed to load tasks: ${tasksError.message}`);

  const meetingRef = meeting ? buildMeetingReference(meeting, appUrl) : null;
  const mappedTasks = (tasks ?? [])
    .map((row) => mapTaskRow(row as Record<string, unknown>))
    .filter((row): row is ReminderTaskRow => row !== null);

  return { meeting: meetingRef, tasks: mappedTasks };
}

export async function fetchReminderTasksForUser(
  supabase: SupabaseClient,
  userId: string,
): Promise<ReminderTaskItem[]> {
  const { appUrl } = getReminderConfig();

  const { data: meetings, error: meetingsError } = await supabase
    .from("meetings")
    .select("id,file_name,file_url,created_at");

  if (meetingsError) throw new Error(`Failed to load meetings: ${meetingsError.message}`);

  const ownedMeetings = (meetings ?? []).filter(
    (meeting) => userIdFromMeetingFileUrl(meeting.file_url) === userId,
  );

  if (ownedMeetings.length === 0) return [];

  const meetingMap = new Map(
    ownedMeetings.map((meeting) => [
      meeting.id,
      buildMeetingReference(meeting, appUrl),
    ]),
  );

  const meetingIds = ownedMeetings.map((meeting) => meeting.id);
  const { data: tasks, error: tasksError } = await supabase
    .from("tasks")
    .select("id,meeting_id,task,owner,deadline,status")
    .in("meeting_id", meetingIds);

  if (tasksError) throw new Error(`Failed to load tasks: ${tasksError.message}`);

  const items: ReminderTaskItem[] = [];
  for (const row of tasks ?? []) {
    const mapped = mapTaskRow(row as Record<string, unknown>);
    if (!mapped) continue;
    const meeting = meetingMap.get(mapped.meeting_id);
    if (!meeting) continue;
    items.push({ ...mapped, meeting });
  }

  return items;
}

export function attachMeetingToTasks(
  tasks: ReminderTaskRow[],
  meeting: MeetingReference,
): ReminderTaskItem[] {
  return tasks.map((task) => ({ ...task, meeting }));
}

export async function fetchTeamMembersForMeeting(
  supabase: SupabaseClient,
  meetingId: string,
): Promise<TeamMemberRecord[]> {
  const { data, error } = await supabase
    .from("team_members")
    .select("id, name, email")
    .eq("meeting_id", meetingId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Failed to load team members: ${error.message}`);
  }

  return mapTeamMemberRows(data ?? []);
}

export async function fetchTeamMembersForMeetings(
  supabase: SupabaseClient,
  meetingIds: string[],
): Promise<Map<string, TeamMemberRecord[]>> {
  const result = new Map<string, TeamMemberRecord[]>();
  if (meetingIds.length === 0) return result;

  const { data, error } = await supabase
    .from("team_members")
    .select("id, meeting_id, name, email")
    .in("meeting_id", meetingIds)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Failed to load team members: ${error.message}`);
  }

  for (const row of data ?? []) {
    const meetingId = String(row.meeting_id);
    const members = result.get(meetingId) ?? [];
    members.push({
      id: String(row.id),
      name: row.name != null ? String(row.name) : "",
      email: row.email != null ? String(row.email) : "",
    });
    result.set(meetingId, members);
  }

  return result;
}

export async function fetchAllReminderTaskItems(
  supabase: SupabaseClient,
): Promise<ReminderTaskItem[]> {
  const { appUrl } = getReminderConfig();

  const { data: meetings, error: meetingsError } = await supabase
    .from("meetings")
    .select("id,file_name,created_at");

  if (meetingsError) {
    throw new Error(`Failed to load meetings: ${meetingsError.message}`);
  }

  const meetingMap = new Map(
    (meetings ?? []).map((meeting) => [
      meeting.id,
      buildMeetingReference(meeting, appUrl),
    ]),
  );

  const meetingIds = [...meetingMap.keys()];
  if (meetingIds.length === 0) return [];

  const { data: tasks, error: tasksError } = await supabase
    .from("tasks")
    .select("id,meeting_id,task,owner,deadline,status")
    .in("meeting_id", meetingIds);

  if (tasksError) {
    throw new Error(`Failed to load tasks: ${tasksError.message}`);
  }

  const items: ReminderTaskItem[] = [];
  for (const row of tasks ?? []) {
    const mapped = mapTaskRow(row as Record<string, unknown>);
    if (!mapped) continue;
    const meeting = meetingMap.get(mapped.meeting_id);
    if (!meeting) continue;
    items.push({ ...mapped, meeting });
  }

  return items;
}

import type { SupabaseClient } from "@supabase/supabase-js";
import { getPipelineDisplayStatus } from "@/lib/meetings/meeting-display";
import { enrichMeetingRecord } from "@/lib/meetings/record";
import { mapMeetingTaskRow, TASK_COLUMNS } from "@/lib/meetings/task-record";
import { titleFromFileName } from "@/lib/meetings/validation";
import { assistantLog } from "./assistant-debug";
import type { AssistantCorpus, AssistantMeetingRecord } from "./types";

export const ASSISTANT_MEETING_COLUMNS =
  "id,file_name,file_url,transcript,summary,status,created_at,title";

type MeetingRow = {
  id: string;
  file_name: string | null;
  file_url: string | null;
  transcript: string | null;
  summary: string | null;
  status: string | null;
  created_at: string;
};

function formatMeetingDate(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(iso));
}

function mapPipelineStatus(
  meeting: ReturnType<typeof enrichMeetingRecord>,
): AssistantMeetingRecord["pipelineStatus"] {
  const pipeline = getPipelineDisplayStatus(meeting);
  if (pipeline === "completed") return "ready";
  return pipeline;
}

export async function loadAssistantCorpus(
  supabase: SupabaseClient,
): Promise<AssistantCorpus> {
  assistantLog("loading corpus started");

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    assistantLog("auth user lookup failed", { message: authError.message });
  }

  const { data: meetingRows, error: meetingsError } = await supabase
    .from("meetings")
    .select(ASSISTANT_MEETING_COLUMNS)
    .order("created_at", { ascending: false });

  if (meetingsError) {
    throw new Error(`Failed to load meetings: ${meetingsError.message}`);
  }

  const rows = (meetingRows ?? []) as MeetingRow[];
  const meetingIds = rows.map((row) => row.id);

  let tasksByMeeting = new Map<string, AssistantMeetingRecord["tasks"]>();

  if (meetingIds.length > 0) {
    const { data: taskRows, error: tasksError } = await supabase
      .from("tasks")
      .select(TASK_COLUMNS)
      .in("meeting_id", meetingIds)
      .order("created_at", { ascending: true });

    if (tasksError) {
      throw new Error(`Failed to load tasks: ${tasksError.message}`);
    }

    tasksByMeeting = new Map();
    for (const row of taskRows ?? []) {
      const mapped = mapMeetingTaskRow(row as Record<string, unknown>);
      if (!mapped) continue;
      const list = tasksByMeeting.get(mapped.meeting_id) ?? [];
      list.push({
        id: mapped.id,
        task: mapped.task,
        owner: mapped.owner,
        deadline: mapped.deadline,
        status: mapped.status,
      });
      tasksByMeeting.set(mapped.meeting_id, list);
    }
  }

  const meetings: AssistantMeetingRecord[] = rows.map((row) => {
    const meeting = enrichMeetingRecord(row);
    return {
      meetingId: meeting.id,
      meetingTitle: resolveMeetingTitle(row, meeting.title),
      meetingDate: formatMeetingDate(meeting.created_at),
      createdAt: meeting.created_at,
      summary: meeting.summary,
      transcript: meeting.transcript,
      pipelineStatus: mapPipelineStatus(meeting),
      tasks: tasksByMeeting.get(meeting.id) ?? [],
    };
  });

  assistantLog("loading corpus complete", {
    meetingCount: meetings.length,
    taskCount: meetings.reduce((sum, meeting) => sum + meeting.tasks.length, 0),
    userId: user?.id ?? null,
  });

  return {
    meetings,
    userEmail: user?.email ?? null,
    userName: user?.user_metadata?.full_name ?? user?.user_metadata?.name ?? null,
  };
}

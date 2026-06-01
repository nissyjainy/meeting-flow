import { createClient } from "@/lib/supabase/client";
import {
  listAllTaskStatusEvents,
  listAllTasks,
  listMeetings,
} from "@/lib/meetings/api";
import { buildNotifications } from "./build-notifications";
import type { NotificationFeedItem, ReminderSendRecord } from "./types";

const REMINDER_SEND_COLUMNS = "id,meeting_id,recipient,subject,sent_at";

export async function listReminderSends(): Promise<ReminderSendRecord[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("reminder_sends")
    .select(REMINDER_SEND_COLUMNS)
    .order("sent_at", { ascending: false });

  if (error) {
    console.warn("[notifications] reminder_sends query failed (using empty list)", {
      message: error.message,
      code: error.code,
    });
    return [];
  }

  return (data ?? []).map((row) => ({
    id: String(row.id),
    meeting_id: row.meeting_id != null ? String(row.meeting_id) : null,
    recipient: row.recipient != null ? String(row.recipient) : "",
    subject: row.subject != null ? String(row.subject) : null,
    sent_at: String(row.sent_at),
  }));
}

export async function loadNotificationFeed(): Promise<NotificationFeedItem[]> {
  const [meetings, tasks, taskStatusEvents, reminderSends] = await Promise.all([
    listMeetings(),
    listAllTasks(),
    listAllTaskStatusEvents(),
    listReminderSends(),
  ]);

  return buildNotifications({
    meetings,
    tasks,
    taskStatusEvents,
    reminderSends,
  });
}

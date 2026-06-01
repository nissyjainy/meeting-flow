import type { TaskStatusEventRecord } from "@/lib/analytics/task-status-event-record";
import { hasSummary } from "@/lib/meetings/meeting-display";
import type { MeetingRecord, MeetingTaskRecord } from "@/lib/meetings/types";
import { formatNotificationTime } from "./format-notification-time";
import type { NotificationFeedItem, ReminderSendRecord } from "./types";

function formatStatusLabel(status: string): string {
  return status.replace(/_/g, " ");
}

function buildMeetingTitleLookup(meetings: MeetingRecord[]): Map<string, string> {
  const lookup = new Map<string, string>();
  for (const meeting of meetings) {
    lookup.set(meeting.id, meeting.title);
  }
  return lookup;
}

function buildTaskLookup(tasks: MeetingTaskRecord[]): Map<string, MeetingTaskRecord> {
  const lookup = new Map<string, MeetingTaskRecord>();
  for (const task of tasks) {
    lookup.set(task.id, task);
  }
  return lookup;
}

function meetingSummaryNotifications(
  meetings: MeetingRecord[],
  referenceDate: Date,
): NotificationFeedItem[] {
  return meetings
    .filter((meeting) => meeting.status === "ready" && hasSummary(meeting))
    .map((meeting) => ({
      id: `meeting-summary:${meeting.id}`,
      type: "summary" as const,
      title: "AI summary ready",
      description: meeting.title,
      occurredAt: meeting.created_at,
      time: formatNotificationTime(meeting.created_at, referenceDate),
    }));
}

function meetingFailedNotifications(
  meetings: MeetingRecord[],
  referenceDate: Date,
): NotificationFeedItem[] {
  return meetings
    .filter((meeting) => meeting.status === "failed")
    .map((meeting) => ({
      id: `meeting-failed:${meeting.id}`,
      type: "meeting" as const,
      title: "Processing failed",
      description: meeting.title,
      occurredAt: meeting.created_at,
      time: formatNotificationTime(meeting.created_at, referenceDate),
    }));
}

function tasksExtractedNotifications(
  tasks: MeetingTaskRecord[],
  meetingTitles: Map<string, string>,
  referenceDate: Date,
): NotificationFeedItem[] {
  const tasksByMeeting = new Map<string, MeetingTaskRecord[]>();

  for (const task of tasks) {
    const existing = tasksByMeeting.get(task.meeting_id) ?? [];
    existing.push(task);
    tasksByMeeting.set(task.meeting_id, existing);
  }

  const items: NotificationFeedItem[] = [];

  for (const [meetingId, meetingTasks] of tasksByMeeting) {
    if (meetingTasks.length === 0) continue;

    const latestCreatedAt = meetingTasks.reduce((latest, task) => {
      return task.created_at > latest ? task.created_at : latest;
    }, meetingTasks[0]!.created_at);

    const meetingTitle = meetingTitles.get(meetingId) ?? "Meeting";
    const count = meetingTasks.length;

    items.push({
      id: `tasks-extracted:${meetingId}`,
      type: "task",
      title: "Action items extracted",
      description: `${count} action item${count === 1 ? "" : "s"} extracted — ${meetingTitle}`,
      occurredAt: latestCreatedAt,
      time: formatNotificationTime(latestCreatedAt, referenceDate),
    });
  }

  return items;
}

function taskStatusEventNotifications(
  events: TaskStatusEventRecord[],
  tasksById: Map<string, MeetingTaskRecord>,
  referenceDate: Date,
): NotificationFeedItem[] {
  const items: NotificationFeedItem[] = [];

  for (const event of events) {
    if (event.source === "backfill" || event.source === "extraction") continue;

    const task = tasksById.get(event.task_id);
    const taskLabel = task?.task ?? "Task";

    if (event.to_status === "completed") {
      items.push({
        id: `task-event:${event.id}`,
        type: "task",
        title: "Task completed",
        description: taskLabel,
        occurredAt: event.occurred_at,
        time: formatNotificationTime(event.occurred_at, referenceDate),
      });
      continue;
    }

    if (event.from_status != null && event.from_status !== event.to_status) {
      items.push({
        id: `task-event:${event.id}`,
        type: "task",
        title: "Task updated",
        description: `${taskLabel} · ${formatStatusLabel(event.to_status)}`,
        occurredAt: event.occurred_at,
        time: formatNotificationTime(event.occurred_at, referenceDate),
      });
    }
  }

  return items;
}

function reminderSendNotifications(
  reminders: ReminderSendRecord[],
  meetingTitles: Map<string, string>,
  referenceDate: Date,
): NotificationFeedItem[] {
  return reminders.map((reminder) => {
    const meetingTitle =
      reminder.meeting_id != null ? meetingTitles.get(reminder.meeting_id) : undefined;
    const detail = reminder.subject?.trim() || reminder.recipient;
    const description = meetingTitle ? `${detail} — ${meetingTitle}` : detail;

    return {
      id: `reminder-send:${reminder.id}`,
      type: "task" as const,
      title: "Reminder sent",
      description,
      occurredAt: reminder.sent_at,
      time: formatNotificationTime(reminder.sent_at, referenceDate),
    };
  });
}

export function buildNotifications(input: {
  meetings: MeetingRecord[];
  tasks: MeetingTaskRecord[];
  taskStatusEvents: TaskStatusEventRecord[];
  reminderSends: ReminderSendRecord[];
  referenceDate?: Date;
}): NotificationFeedItem[] {
  const referenceDate = input.referenceDate ?? new Date();
  const meetingTitles = buildMeetingTitleLookup(input.meetings);
  const tasksById = buildTaskLookup(input.tasks);

  const items = [
    ...meetingSummaryNotifications(input.meetings, referenceDate),
    ...meetingFailedNotifications(input.meetings, referenceDate),
    ...tasksExtractedNotifications(input.tasks, meetingTitles, referenceDate),
    ...taskStatusEventNotifications(input.taskStatusEvents, tasksById, referenceDate),
    ...reminderSendNotifications(input.reminderSends, meetingTitles, referenceDate),
  ];

  return items.sort(
    (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
  );
}

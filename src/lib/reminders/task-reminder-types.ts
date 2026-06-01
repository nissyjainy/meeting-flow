export type ReminderTaskRow = {
  id: string;
  meeting_id: string;
  task: string;
  owner: string | null;
  deadline: string | null;
  status: string;
};

export type MeetingReference = {
  id: string;
  title: string;
  fileName: string;
  createdAt: string;
  url: string;
};

export type ReminderTaskItem = ReminderTaskRow & {
  meeting: MeetingReference;
};

export type ReminderCategory = "pending" | "upcoming" | "sameDay" | "overdue";

export type ClassifiedReminderTasks = {
  pending: ReminderTaskItem[];
  upcoming: ReminderTaskItem[];
  sameDay: ReminderTaskItem[];
  overdue: ReminderTaskItem[];
};

export type ReminderEmailOutcome = {
  success: boolean;
  sent: boolean;
  messageId?: string;
  error?: string;
  skippedReason?: string;
};

export type TeamMemberRecord = {
  id: string;
  name: string;
  email: string;
};

export type AppNotificationType = "mention" | "task" | "meeting" | "summary";

export type AppNotification = {
  id: string;
  type: AppNotificationType;
  title: string;
  description: string;
  /** ISO timestamp for sorting; formatted for display in `time`. */
  occurredAt: string;
  time: string;
  read: boolean;
};

export type NotificationFeedItem = Omit<AppNotification, "read">;

export type ReminderSendRecord = {
  id: string;
  meeting_id: string | null;
  recipient: string;
  subject: string | null;
  sent_at: string;
};

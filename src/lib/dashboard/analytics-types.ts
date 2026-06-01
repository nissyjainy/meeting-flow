import type { DisplayTaskStatus } from "@/lib/meetings/task-status";

export type WeeklyActivityPoint = {
  day: string;
  meetings: number;
  tasks: number;
};

export type DashboardMeetingSummary = {
  id: string;
  title: string;
  date: string;
  summary: string | null;
  recordingType: string;
  actionItems: number;
  status: "ready" | "processing" | "failed";
};

export type ExecutionSummary = {
  totalOpen: number;
  overdue: number;
  dueToday: number;
  completedThisWeek: number;
};

export type DashboardPriorityTask = {
  id: string;
  title: string;
  displayStatus: DisplayTaskStatus;
  dueDate: string | null;
  meetingId: string;
};

export type DashboardAnalytics = {
  totalMeetings: number;
  pendingTasks: number;
  overdueTasks: number;
  completedTasks: number;
  remindersSent: number;
  execution: ExecutionSummary;
  topPriorities: DashboardPriorityTask[];
  weeklyActivity: WeeklyActivityPoint[];
  recentMeetings: DashboardMeetingSummary[];
};

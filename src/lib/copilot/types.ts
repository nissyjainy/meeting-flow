import type { AccountabilityAnalytics } from "@/lib/analytics/accountability-analytics";
import type { ExecutionHealthBundle } from "@/lib/execution-health/execution-health";
import type { DisplayTaskStatus } from "@/lib/meetings/task-status";
import type {
  DashboardPriorityTask,
  ExecutionSummary,
} from "@/lib/dashboard/analytics-types";
import type { CopilotAdvancedInsights } from "./copilot-advanced-insights";

export type CopilotIntent =
  | "meeting_summary"
  | "extracted_tasks"
  | "task_owners"
  | "task_deadlines"
  | "reminder_status"
  | "pending_tasks"
  | "overdue_tasks"
  | "completion_stats"
  | "reminder_history"
  | "execution_health"
  | "completion_rate"
  | "on_time_completion"
  | "average_completion_time"
  | "best_performer"
  | "most_delayed_owner"
  | "weekly_completion_trend"
  | "owner_improvement"
  | "owner_decline"
  | "execution_bottlenecks"
  | "meetings_most_tasks"
  | "at_risk_owners"
  | "at_risk_tasks"
  | "weekly_focus"
  | "workload_imbalance"
  | "executive_briefing";

export type CopilotMessageRole = "user" | "assistant";

export type CopilotMessage = {
  id: string;
  role: CopilotMessageRole;
  text: string;
  intent?: CopilotIntent | "unsupported";
  error?: boolean;
};

export type CopilotTaskContext = {
  id: string;
  meetingId?: string;
  meetingTitle?: string;
  task: string;
  owner: string | null;
  ownerEmail: string | null;
  deadline: string | null;
  storedStatus: string;
  status: DisplayTaskStatus;
  reminderCategory: string | null;
};

export type CopilotMeetingSummary = {
  meetingId: string;
  meetingTitle: string;
  summary: string | null;
  pipelineStatus: "ready" | "processing" | "failed" | "none";
  createdAt: string;
  taskCount: number;
};

export type CopilotReminderHistoryEntry = {
  id: string;
  meetingId: string | null;
  meetingTitle: string;
  recipient: string;
  subject: string | null;
  sentAt: string;
};

export type CopilotWorkspaceContext = {
  meetings: CopilotMeetingSummary[];
  tasks: CopilotTaskContext[];
  execution: ExecutionSummary;
  taskStats: {
    pendingTasks: number;
    overdueTasks: number;
    completedTasks: number;
  };
  accountability: AccountabilityAnalytics;
  executionHealth: ExecutionHealthBundle;
  advancedInsights: CopilotAdvancedInsights;
  topPriorities: DashboardPriorityTask[];
  remindersSent: number;
  reminderHistory: CopilotReminderHistoryEntry[];
};

export type CopilotMeetingContext = {
  meetingId: string | null;
  meetingTitle: string;
  summary: string | null;
  pipelineStatus: "ready" | "processing" | "failed" | "none";
  tasks: CopilotTaskContext[];
  remindersSent: number;
};

export type CopilotQueryResult = {
  supported: boolean;
  intent: CopilotIntent | "unsupported";
  answer: string;
  meetingId: string | null;
  meetingTitle: string;
};

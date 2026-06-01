import type { CopilotIntent } from "./types";

/** Phase 3 advanced insights — evaluated before broader task/owner patterns. */
const ADVANCED_INSIGHT_PATTERNS: Array<{ intent: CopilotIntent; pattern: RegExp }> = [
  {
    intent: "executive_briefing",
    pattern:
      /\b(executive briefing|leadership briefing|leadership summary|summarize execution health|execution health briefing|what should leadership know|what leadership should know)\b/i,
  },
  {
    intent: "weekly_focus",
    pattern:
      /\b(focus this week|what should i focus|weekly (?:execution )?recommend(?:ation)?s?|priorities this week|what to focus on)\b/i,
  },
  {
    intent: "owner_improvement",
    pattern:
      /\b(improved the most|who improved|getting better|most improvement|improvement trend)\b/i,
  },
  {
    intent: "owner_decline",
    pattern:
      /\b(declined|falling behind|getting worse|who slipped|decline trend)\b/i,
  },
  {
    intent: "execution_bottlenecks",
    pattern:
      /\b(slowing execution|execution bottleneck|what(?:'s| is) blocking|blocking progress|what is slowing)\b/i,
  },
  {
    intent: "meetings_most_tasks",
    pattern:
      /\b(most action items|meetings generating|which meeting(?:s)?(?: generated| created)?(?: the )?most tasks?|most tasks? from meetings?)\b/i,
  },
  {
    intent: "at_risk_owners",
    pattern:
      /\b(owners need attention|at[- ]risk owners|who needs attention|owners needing attention)\b/i,
  },
  {
    intent: "at_risk_tasks",
    pattern:
      /\b((?:which )?tasks?(?: are)? most at risk|at[- ]risk tasks?|highest risk tasks?|most at risk tasks?)\b/i,
  },
  {
    intent: "workload_imbalance",
    pattern:
      /\b(workload imbalance|uneven workload|overloaded|workload distribution|is workload balanced)\b/i,
  },
];

/** Workspace-scoped intents (Phase 2+). Evaluated before broader legacy patterns. */
const WORKSPACE_INTENT_PATTERNS: Array<{ intent: CopilotIntent; pattern: RegExp }> = [
  ...ADVANCED_INSIGHT_PATTERNS,
  {
    intent: "execution_health",
    pattern:
      /\b(execution health|accountability analytics|team performance|show (?:the )?(?:team )?(?:execution|accountability) (?:health|overview|summary))\b/i,
  },
  {
    intent: "best_performer",
    pattern:
      /\b(best performer|top performer|who is (?:the )?best(?: performer)?|highest completion rate)\b/i,
  },
  {
    intent: "most_delayed_owner",
    pattern:
      /\b(most delayed owner|who (?:has|is) (?:the )?most (?:overdue|delayed)|worst performer|least reliable owner)\b/i,
  },
  {
    intent: "weekly_completion_trend",
    pattern:
      /\b(weekly completion(?: trend)?|completion trend|completions? per week|tasks? completed (?:each|per) week)\b/i,
  },
  {
    intent: "on_time_completion",
    pattern:
      /\b(on[- ]time completion(?: rate|%)?|completed on time|on time rate|on[- ]time rate)\b/i,
  },
  {
    intent: "average_completion_time",
    pattern:
      /\b(average completion time|avg completion time|how long (?:does|do) (?:it|tasks?) take|mean completion time)\b/i,
  },
  {
    intent: "completion_rate",
    pattern:
      /\b((?:team(?:'s)?|what(?:'s| is) (?:the|our)? )?completion rate|what percent(?:age)? (?:of )?tasks? (?:are )?completed)\b/i,
  },
  {
    intent: "reminder_history",
    pattern:
      /\b(reminder history|recent reminders?|reminders? sent|emails? sent|who (?:got|received|was sent) reminders?|show (?:my )?reminder emails?)\b/i,
  },
  {
    intent: "completion_stats",
    pattern:
      /\b(completion stats?(?:istics)?|completed this week|how many (?:tasks? )?(?:are )?(?:completed|done|finished)|tasks? completed|completion progress)\b/i,
  },
  {
    intent: "overdue_tasks",
    pattern:
      /\b(overdue tasks?|late tasks?|past due tasks?|what(?:'s| is) overdue|what tasks are overdue|tasks? that are overdue|show overdue)\b/i,
  },
  {
    intent: "pending_tasks",
    pattern:
      /\b(pending tasks?|open tasks?|in[- ]progress tasks?|unfinished tasks?|incomplete tasks?|active tasks?|show pending)\b/i,
  },
];

const MEETING_INTENT_PATTERNS: Array<{ intent: CopilotIntent; pattern: RegExp }> = [
  {
    intent: "reminder_status",
    pattern: /\b(reminder status|reminder eligibility|tasks? (?:to|for) remind|notification status)\b/i,
  },
  {
    intent: "task_owners",
    pattern: /\b(owner|owners|assignee|assignees|assigned to|who owns|who is responsible|responsible)\b/i,
  },
  {
    intent: "task_deadlines",
    pattern: /\b(deadline|deadlines|due date|due dates|when is .+ due|show deadlines?)\b/i,
  },
  {
    intent: "meeting_summary",
    pattern: /\b(summary|summarize|summarise|recap|overview|tldr|what was discussed|what happened)\b/i,
  },
  {
    intent: "extracted_tasks",
    pattern: /\b(tasks?|action items?|to-?dos?|extracted|open items?|action item|list action items?)\b/i,
  },
];

const INTENT_PATTERNS = [...WORKSPACE_INTENT_PATTERNS, ...MEETING_INTENT_PATTERNS];

export const COPILOT_ADVANCED_INTENTS = new Set<CopilotIntent>(
  ADVANCED_INSIGHT_PATTERNS.map(({ intent }) => intent),
);

export const COPILOT_WORKSPACE_INTENTS = new Set<CopilotIntent>(
  WORKSPACE_INTENT_PATTERNS.map(({ intent }) => intent),
);

export function intentUsesWorkspaceContext(intent: CopilotIntent): boolean {
  return COPILOT_WORKSPACE_INTENTS.has(intent);
}

export const COPILOT_SUPPORTED_QUERY_EXAMPLES: Record<CopilotIntent, string[]> = {
  meeting_summary: ["Summarize this meeting", "What was discussed?", "Give me a recap"],
  extracted_tasks: ["List action items", "Show all tasks", "What are the to-dos?"],
  task_owners: ["Who owns each task?", "Show assignees", "Who is responsible?"],
  task_deadlines: ["Show deadlines", "When is each task due?", "List due dates"],
  reminder_status: ["Reminder status", "Which tasks are eligible for reminders?"],
  pending_tasks: ["Show pending tasks", "What open tasks do I have?", "List unfinished tasks"],
  overdue_tasks: ["What tasks are overdue?", "Show overdue tasks", "What's past due?"],
  completion_stats: [
    "Completion statistics",
    "How many tasks are completed?",
    "Show completed this week",
  ],
  reminder_history: [
    "Reminder history",
    "Who received reminder emails?",
    "Show recent reminders sent",
  ],
  execution_health: ["Show execution health", "Team performance overview", "Accountability analytics"],
  completion_rate: ["What is the team's completion rate?", "Completion rate", "What percentage of tasks are completed?"],
  on_time_completion: ["On-time completion rate", "What percent completed on time?", "Completed on time"],
  average_completion_time: ["Average completion time", "How long do tasks take?", "Avg completion time"],
  best_performer: ["Who is the best performer?", "Top performer", "Highest completion rate owner"],
  most_delayed_owner: ["Who has the most overdue tasks?", "Most delayed owner", "Worst performer"],
  weekly_completion_trend: ["Weekly completion trend", "Completions per week", "Show completion trend"],
  owner_improvement: ["Who improved the most this month?", "Who is getting better?", "Most improvement"],
  owner_decline: ["Who declined this month?", "Who is falling behind?", "Who slipped?"],
  execution_bottlenecks: ["What is slowing execution?", "What are the bottlenecks?", "What's blocking progress?"],
  meetings_most_tasks: [
    "Which meetings generated the most action items?",
    "Meetings with most tasks",
  ],
  at_risk_owners: ["Which owners need attention?", "At-risk owners", "Who needs attention?"],
  at_risk_tasks: ["Which tasks are most at risk?", "At-risk tasks", "Highest risk tasks"],
  weekly_focus: ["What should I focus on this week?", "Weekly recommendations", "Focus this week"],
  workload_imbalance: ["Is workload balanced?", "Workload imbalance", "Uneven workload"],
  executive_briefing: [
    "Give me an executive briefing",
    "Summarize execution health",
    "What should leadership know this week?",
  ],
};

export function classifyCopilotIntent(query: string): CopilotIntent | null {
  const trimmed = query.trim();
  if (!trimmed) return null;

  for (const { intent, pattern } of INTENT_PATTERNS) {
    if (pattern.test(trimmed)) {
      console.info("[copilot-intent] classified", {
        query: trimmed,
        intent,
        scope: intentUsesWorkspaceContext(intent) ? "workspace" : "meeting",
        pattern: pattern.source,
      });
      return intent;
    }
  }

  console.info("[copilot-intent] unmatched", { query: trimmed });
  return null;
}

export const COPILOT_SUGGESTIONS: Array<{ intent: CopilotIntent; label: string }> = [
  { intent: "meeting_summary", label: "Summarize this meeting" },
  { intent: "extracted_tasks", label: "List action items" },
  { intent: "task_owners", label: "Who owns each task?" },
  { intent: "task_deadlines", label: "Show deadlines" },
  { intent: "reminder_status", label: "Reminder status" },
];

export function suggestionQuery(intent: CopilotIntent): string {
  return COPILOT_SUGGESTIONS.find((item) => item.intent === intent)?.label ?? intent;
}

function formatExampleList(): string {
  const lines = [
    "Weekly focus: \"What should I focus on this week?\"",
    "Executive briefing: \"Give me an executive briefing\"",
    "Owner improvement: \"Who improved the most this month?\"",
    "At-risk tasks: \"Which tasks are most at risk?\"",
    "Execution health: \"Show execution health\"",
    "Completion rate: \"What is the team's completion rate?\"",
    "Best performer: \"Who is the best performer?\"",
    "Most delayed: \"Who has the most overdue tasks?\"",
    "Meeting summaries: \"Summarize this meeting\"",
    "Action items: \"List action items\"",
    "Pending tasks: \"Show pending tasks\"",
    "Overdue tasks: \"What tasks are overdue?\"",
    "Completion stats: \"How many tasks are completed?\"",
    "Reminder history: \"Show recent reminders sent\"",
    "Owners: \"Who owns each task?\"",
    "Deadlines: \"Show deadlines\"",
    "Reminder status: \"Reminder status\"",
  ];
  return lines.map((line) => `• ${line}`).join("\n");
}

export const COPILOT_UNSUPPORTED_MESSAGE = [
  "I focus on meeting and task data only. Supported queries include:",
  formatExampleList(),
  "",
  'Try: "What should I focus on this week?" or "Give me an executive briefing".',
].join("\n");

export const COPILOT_SCOPE_MESSAGE =
  "Open a meeting or upload a recording first — I need meeting context to answer that.";

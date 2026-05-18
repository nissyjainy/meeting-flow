export type MeetingStatus = "processing" | "ready" | "scheduled";
export type TaskStatus = "todo" | "in-progress" | "review" | "done";
export type TaskPriority = "low" | "medium" | "high" | "urgent";

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar: string;
  status: "online" | "offline" | "away";
}

export interface Meeting {
  id: string;
  title: string;
  date: string;
  duration: string;
  participants: string[];
  status: MeetingStatus;
  summary: string;
  tags: string[];
  recordingType: "Zoom" | "Google Meet" | "Teams" | "Upload";
  actionItems: number;
}

export interface TranscriptLine {
  id: string;
  speaker: string;
  time: string;
  text: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  assignee: string;
  dueDate: string;
  meetingId?: string;
  progress: number;
  tags: string[];
}

export interface AppNotification {
  id: string;
  type: "mention" | "task" | "meeting" | "summary";
  title: string;
  description: string;
  time: string;
  read: boolean;
}

export const team: TeamMember[] = [
  { id: "u1", name: "Ava Chen", email: "ava@northstar.io", role: "Product Lead", avatar: "AC", status: "online" },
  { id: "u2", name: "Marcus Reed", email: "marcus@northstar.io", role: "Eng Manager", avatar: "MR", status: "online" },
  { id: "u3", name: "Priya Sharma", email: "priya@northstar.io", role: "Designer", avatar: "PS", status: "away" },
  { id: "u4", name: "Jonas Weber", email: "jonas@northstar.io", role: "Data Scientist", avatar: "JW", status: "offline" },
  { id: "u5", name: "Sofia Romano", email: "sofia@northstar.io", role: "Customer Success", avatar: "SR", status: "online" },
  { id: "u6", name: "Daniel Park", email: "daniel@northstar.io", role: "Founder / CEO", avatar: "DP", status: "online" },
];

export const meetings: Meeting[] = [
  {
    id: "m1",
    title: "Q3 Product Roadmap Sync",
    date: "Today · 10:30 AM",
    duration: "48 min",
    participants: ["AC", "MR", "DP", "PS"],
    status: "ready",
    summary: "Aligned on Q3 priorities: shipping AI summaries v2, kicking off enterprise SSO, deprecating legacy export.",
    tags: ["Product", "Roadmap"],
    recordingType: "Zoom",
    actionItems: 6,
  },
  {
    id: "m2",
    title: "Acme Corp · Discovery Call",
    date: "Today · 9:00 AM",
    duration: "32 min",
    participants: ["SR", "DP"],
    status: "ready",
    summary: "Acme is evaluating us against Fireflies. Key blockers: SOC2, Salesforce sync, custom vocab.",
    tags: ["Sales", "Enterprise"],
    recordingType: "Google Meet",
    actionItems: 4,
  },
  {
    id: "m3",
    title: "Engineering Weekly",
    date: "Yesterday",
    duration: "55 min",
    participants: ["MR", "JW", "PS"],
    status: "ready",
    summary: "Migrated transcript pipeline to streaming. Latency down 38%. Vector store consolidation next sprint.",
    tags: ["Engineering"],
    recordingType: "Teams",
    actionItems: 9,
  },
  {
    id: "m4",
    title: "Design Critique · Onboarding",
    date: "Yesterday",
    duration: "27 min",
    participants: ["PS", "AC"],
    status: "processing",
    summary: "",
    tags: ["Design"],
    recordingType: "Upload",
    actionItems: 0,
  },
  {
    id: "m5",
    title: "Board Update · November",
    date: "Mon · 4:00 PM",
    duration: "1h 12m",
    participants: ["DP", "AC", "MR"],
    status: "ready",
    summary: "ARR crossed $4.2M. CAC payback shortened to 7.4 months. Series B prep in motion.",
    tags: ["Leadership"],
    recordingType: "Zoom",
    actionItems: 3,
  },
  {
    id: "m6",
    title: "Customer Advisory Board",
    date: "Thu · 1:00 PM",
    duration: "scheduled",
    participants: ["SR", "DP", "AC"],
    status: "scheduled",
    summary: "",
    tags: ["Customer"],
    recordingType: "Zoom",
    actionItems: 0,
  },
];

export const transcript: TranscriptLine[] = [
  { id: "t1", speaker: "Daniel Park", time: "00:00:08", text: "Thanks everyone for hopping on. Let's start with the Q3 themes and then unpack roadmap commitments." },
  { id: "t2", speaker: "Ava Chen", time: "00:00:31", text: "Headline themes are AI summaries v2, enterprise readiness, and reducing churn in the sub-$500 segment." },
  { id: "t3", speaker: "Marcus Reed", time: "00:01:14", text: "Engineering can commit to v2 summaries by mid-August if we freeze the prompt schema by next Friday." },
  { id: "t4", speaker: "Priya Sharma", time: "00:02:02", text: "Design will own the copilot panel refresh — I'll have hi-fi mocks circulated Wednesday." },
  { id: "t5", speaker: "Daniel Park", time: "00:02:48", text: "Good. SSO and audit logs land before the Acme pilot — that's a hard gate." },
  { id: "t6", speaker: "Ava Chen", time: "00:03:22", text: "Action item: I'll draft the prompt schema RFC and share with Marcus by EOD Thursday." },
  { id: "t7", speaker: "Marcus Reed", time: "00:04:10", text: "We should also deprecate the legacy CSV export — usage is under 2%." },
  { id: "t8", speaker: "Priya Sharma", time: "00:04:55", text: "Agreed. I'll write the in-app sunset notice for the export modal." },
];

export const aiSummary = {
  tldr: "The team committed to shipping AI Summaries v2 by mid-August, unblocking the Acme enterprise pilot, and deprecating the legacy CSV export.",
  keyPoints: [
    "Prompt schema must be frozen by next Friday to hit the August release.",
    "SSO + audit logs are a hard gate for Acme — engineering owns delivery.",
    "Copilot panel refresh is in hi-fi design this week.",
    "Legacy CSV export will be sunset; <2% of accounts depend on it.",
  ],
  decisions: [
    "Ship AI Summaries v2 by August 15.",
    "Deprecate legacy CSV export with 30-day in-app notice.",
    "Prioritize enterprise SSO ahead of integrations backlog.",
  ],
  sentiment: "Aligned & decisive",
  topics: ["AI Summaries v2", "Enterprise SSO", "Copilot UX", "Legacy export sunset"],
};

export const tasks: Task[] = [
  { id: "tk1", title: "Draft prompt schema RFC", description: "v2 summaries — input/output contract.", status: "in-progress", priority: "high", assignee: "AC", dueDate: "Thu", meetingId: "m1", progress: 60, tags: ["RFC", "AI"] },
  { id: "tk2", title: "Freeze prompt schema", description: "Lock for Aug 15 release train.", status: "todo", priority: "urgent", assignee: "MR", dueDate: "Fri", meetingId: "m1", progress: 0, tags: ["AI"] },
  { id: "tk3", title: "Copilot panel hi-fi mocks", description: "Refresh of right-side AI sidebar.", status: "in-progress", priority: "medium", assignee: "PS", dueDate: "Wed", meetingId: "m1", progress: 45, tags: ["Design"] },
  { id: "tk4", title: "SSO architecture doc", description: "SAML + SCIM provisioning.", status: "review", priority: "high", assignee: "JW", dueDate: "Mon", meetingId: "m2", progress: 90, tags: ["Enterprise"] },
  { id: "tk5", title: "Sunset CSV export modal", description: "Add 30-day in-app deprecation notice.", status: "todo", priority: "low", assignee: "PS", dueDate: "Next wk", meetingId: "m1", progress: 0, tags: ["UX"] },
  { id: "tk6", title: "Salesforce sync spike", description: "Acme requirement — scope feasibility.", status: "todo", priority: "high", assignee: "MR", dueDate: "Fri", meetingId: "m2", progress: 0, tags: ["Integrations"] },
  { id: "tk7", title: "Series B narrative deck", description: "Outline + financial model.", status: "in-progress", priority: "urgent", assignee: "DP", dueDate: "Tue", meetingId: "m5", progress: 30, tags: ["Leadership"] },
  { id: "tk8", title: "Streaming pipeline post-mortem", description: "Document 38% latency win.", status: "done", priority: "medium", assignee: "JW", dueDate: "Done", meetingId: "m3", progress: 100, tags: ["Engineering"] },
  { id: "tk9", title: "Onboarding empty-state copy", description: "Rewrite for first-run delight.", status: "review", priority: "medium", assignee: "AC", dueDate: "Wed", meetingId: "m4", progress: 80, tags: ["Onboarding"] },
  { id: "tk10", title: "Acme pilot kickoff plan", description: "Define success criteria + cadence.", status: "done", priority: "high", assignee: "SR", dueDate: "Done", meetingId: "m2", progress: 100, tags: ["Customer"] },
];

export const notifications: AppNotification[] = [
  { id: "n1", type: "summary", title: "AI summary ready", description: "Q3 Product Roadmap Sync — 6 action items extracted.", time: "2m ago", read: false },
  { id: "n2", type: "mention", title: "Marcus mentioned you", description: "“@ava can you own the prompt RFC?”", time: "12m ago", read: false },
  { id: "n3", type: "task", title: "Task due tomorrow", description: "Freeze prompt schema · Urgent", time: "1h ago", read: false },
  { id: "n4", type: "meeting", title: "Meeting starts in 15 min", description: "Customer Advisory Board · Zoom", time: "1h ago", read: true },
  { id: "n5", type: "summary", title: "Acme call summary ready", description: "Key blockers: SOC2, Salesforce, custom vocab.", time: "3h ago", read: true },
];

export const analytics = {
  meetingsThisWeek: 24,
  meetingsDelta: 12,
  hoursSaved: 38.5,
  hoursDelta: 8,
  tasksCreated: 142,
  tasksDelta: 23,
  completionRate: 78,
  completionDelta: 5,
  weekly: [
    { day: "Mon", meetings: 4, tasks: 18 },
    { day: "Tue", meetings: 6, tasks: 22 },
    { day: "Wed", meetings: 3, tasks: 14 },
    { day: "Thu", meetings: 5, tasks: 28 },
    { day: "Fri", meetings: 4, tasks: 24 },
    { day: "Sat", meetings: 1, tasks: 6 },
    { day: "Sun", meetings: 1, tasks: 4 },
  ],
};
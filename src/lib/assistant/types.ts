/** A meeting and its searchable content for the cross-meetings assistant. */
export type AssistantMeetingRecord = {
  meetingId: string;
  meetingTitle: string;
  meetingDate: string;
  createdAt: string;
  summary: string | null;
  transcript: string | null;
  pipelineStatus: "ready" | "processing" | "failed" | "none";
  tasks: AssistantTaskRecord[];
};

export type AssistantTaskRecord = {
  id: string;
  task: string;
  owner: string | null;
  deadline: string | null;
  status: string;
};

/** Full searchable dataset for the logged-in user (extensible to org-wide memory). */
export type AssistantCorpus = {
  meetings: AssistantMeetingRecord[];
  userEmail: string | null;
  userName: string | null;
};

export type AssistantChunkSnippet = {
  chunkIndex: number;
  text: string;
  score: number;
};

/** Result from retrieval (keyword or vector chunk matches). */
export type AssistantSearchHit = {
  meetingId: string;
  score: number;
  matchedFields: string[];
  transcriptSnippet: string | null;
  chunkSnippets?: AssistantChunkSnippet[];
};

export type AssistantSource = {
  meetingId: string;
  meetingTitle: string;
  meetingDate: string;
};

export type AssistantMessageRole = "user" | "assistant";

export type AssistantMessage = {
  id: string;
  role: AssistantMessageRole;
  text: string;
  sources?: AssistantSource[];
  error?: boolean;
};

export type AssistantQueryResult = {
  answer: string;
  sources: AssistantSource[];
  searchedMeetingCount: number;
  contextMeetingCount: number;
};

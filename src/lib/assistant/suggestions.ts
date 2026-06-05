export type AssistantSuggestion = {
  id: string;
  label: string;
  query: string;
};

export const ASSISTANT_SUGGESTIONS: AssistantSuggestion[] = [
  {
    id: "recent-decisions",
    label: "Recent decisions",
    query: "What decisions were made recently across my meetings?",
  },
  {
    id: "my-tasks",
    label: "Tasks assigned to me",
    query: "What tasks are assigned to me across all meetings?",
  },
  {
    id: "marketing",
    label: "Marketing discussions",
    query: "What meetings discussed marketing?",
  },
  {
    id: "deadlines",
    label: "Approaching deadlines",
    query: "What deadlines are approaching across my meetings?",
  },
];

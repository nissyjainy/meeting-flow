import { useCallback, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { askAssistantFn } from "@/lib/assistant/assistant-query.server";
import type { AssistantMessage } from "@/lib/assistant/types";

const WELCOME_MESSAGE =
  "Hi — I can search across all your meetings. Ask about decisions, action items, owners, deadlines, or any topic discussed in your recordings.";

function createMessageId(): string {
  return `assistant-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function useAssistant() {
  const [messages, setMessages] = useState<AssistantMessage[]>([
    {
      id: createMessageId(),
      role: "assistant",
      text: WELCOME_MESSAGE,
    },
  ]);

  const mutation = useMutation({
    mutationFn: (query: string) => askAssistantFn({ data: { query } }),
  });

  const submitQuery = useCallback(
    async (query: string) => {
      const trimmed = query.trim();
      if (!trimmed || mutation.isPending) return;

      const userMessage: AssistantMessage = {
        id: createMessageId(),
        role: "user",
        text: trimmed,
      };

      setMessages((current) => [...current, userMessage]);

      try {
        const result = await mutation.mutateAsync(trimmed);
        const assistantMessage: AssistantMessage = {
          id: createMessageId(),
          role: "assistant",
          text: result.answer,
          sources: result.sources,
        };
        setMessages((current) => [...current, assistantMessage]);
      } catch (error) {
        const assistantMessage: AssistantMessage = {
          id: createMessageId(),
          role: "assistant",
          text:
            error instanceof Error
              ? `Something went wrong: ${error.message}`
              : "Something went wrong while generating an answer.",
          error: true,
        };
        setMessages((current) => [...current, assistantMessage]);
      }
    },
    [mutation],
  );

  return {
    messages,
    submitQuery,
    isLoading: mutation.isPending,
    error: mutation.error instanceof Error ? mutation.error.message : null,
  };
}

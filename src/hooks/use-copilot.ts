import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { askCopilotFn } from "@/lib/copilot/copilot-query.server";
import type { CopilotMessage } from "@/lib/copilot/types";

function createMessageId(): string {
  return `copilot-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function buildWelcomeMessage(meetingTitle?: string | null): string {
  if (meetingTitle) {
    return `Hi — I can answer questions about ${meetingTitle}: summaries, action items, owners, deadlines, and reminder status.`;
  }

  return "Hi — I help with meeting summaries, action items, task owners, deadlines, and reminder status. Open a meeting for summary details.";
}

export function useCopilot(meetingId?: string | null) {
  const [messages, setMessages] = useState<CopilotMessage[]>([]);

  const welcomeMessage = useMemo(
    () => buildWelcomeMessage(meetingId ? "this meeting" : null),
    [meetingId],
  );

  useEffect(() => {
    setMessages([
      {
        id: createMessageId(),
        role: "assistant",
        text: welcomeMessage,
      },
    ]);
  }, [welcomeMessage, meetingId]);

  const mutation = useMutation({
    mutationFn: (query: string) =>
      askCopilotFn({
        data: {
          query,
          meetingId: meetingId ?? null,
        },
      }),
  });

  const submitQuery = useCallback(
    async (query: string) => {
      const trimmed = query.trim();
      if (!trimmed || mutation.isPending) return;

      const userMessage: CopilotMessage = {
        id: createMessageId(),
        role: "user",
        text: trimmed,
      };

      setMessages((current) => [...current, userMessage]);

      try {
        const result = await mutation.mutateAsync(trimmed);
        const assistantMessage: CopilotMessage = {
          id: createMessageId(),
          role: "assistant",
          text: result.answer,
          intent: result.intent,
        };
        setMessages((current) => [...current, assistantMessage]);
      } catch (error) {
        const assistantMessage: CopilotMessage = {
          id: createMessageId(),
          role: "assistant",
          text:
            error instanceof Error
              ? `Something went wrong: ${error.message}`
              : "Something went wrong while fetching meeting data.",
          intent: "unsupported",
          error: true,
        };
        setMessages((current) => [...current, assistantMessage]);
      }
    },
    [meetingId, mutation],
  );

  return {
    messages,
    submitQuery,
    isLoading: mutation.isPending,
    error: mutation.error instanceof Error ? mutation.error.message : null,
  };
}

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { loadCopilotMeetingContext, loadCopilotWorkspaceContext } from "./copilot-data.server";
import {
  formatCopilotMeetingResponse,
  formatCopilotWorkspaceResponse,
} from "./format-response";
import {
  classifyCopilotIntent,
  COPILOT_SCOPE_MESSAGE,
  COPILOT_UNSUPPORTED_MESSAGE,
  intentUsesWorkspaceContext,
} from "./intents";
import type { CopilotIntent, CopilotQueryResult } from "./types";

const CopilotQueryInput = z.object({
  query: z.string().min(1).max(500),
  meetingId: z.string().uuid().nullable().optional(),
});

function parseCopilotInput(raw: unknown): z.infer<typeof CopilotQueryInput> {
  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    if (typeof obj.query === "string") {
      return CopilotQueryInput.parse(obj);
    }
    if (obj.data && typeof obj.data === "object") {
      return CopilotQueryInput.parse(obj.data);
    }
  }
  return CopilotQueryInput.parse(raw);
}

function intentRequiresMeeting(intent: CopilotIntent): boolean {
  return intent === "meeting_summary";
}

export const askCopilotFn = createServerFn({ method: "POST" })
  .inputValidator((raw: unknown) => parseCopilotInput(raw))
  .handler(async ({ data }): Promise<CopilotQueryResult> => {
    const meetingId = data.meetingId ?? null;

    console.info("[copilot-query] request", {
      query: data.query.trim(),
      meetingId,
    });

    const intent = classifyCopilotIntent(data.query);

    if (!intent) {
      return {
        supported: false,
        intent: "unsupported",
        answer: COPILOT_UNSUPPORTED_MESSAGE,
        meetingId,
        meetingTitle: "Meeting Copilot",
      };
    }

    if (intentRequiresMeeting(intent) && !meetingId) {
      return {
        supported: false,
        intent: "unsupported",
        answer: `${COPILOT_SCOPE_MESSAGE}\n\nFor summaries, open a meeting page or ask about tasks, owners, deadlines, or reminders.`,
        meetingId: null,
        meetingTitle: "Meeting Copilot",
      };
    }

    const supabase = getSupabaseServerClient();

    if (intentUsesWorkspaceContext(intent)) {
      const workspace = await loadCopilotWorkspaceContext(supabase);

      if (workspace.meetings.length === 0 && workspace.tasks.length === 0) {
        return {
          supported: false,
          intent: "unsupported",
          answer: COPILOT_SCOPE_MESSAGE,
          meetingId: null,
          meetingTitle: "Meeting Copilot",
        };
      }

      const answer = formatCopilotWorkspaceResponse(intent, workspace, meetingId);

      console.info("[copilot-query] workspace response", {
        intent,
        meetingId,
        meetings: workspace.meetings.length,
        tasks: workspace.tasks.length,
        remindersSent: workspace.remindersSent,
        reminderHistory: workspace.reminderHistory.length,
      });

      return {
        supported: true,
        intent,
        answer,
        meetingId,
        meetingTitle: meetingId
          ? (workspace.meetings.find((m) => m.meetingId === meetingId)?.meetingTitle ??
            "Meeting Copilot")
          : "Your workspace",
      };
    }

    const context = await loadCopilotMeetingContext(supabase, meetingId);

    if (context.pipelineStatus === "none" && intent !== "reminder_status") {
      return {
        supported: false,
        intent: "unsupported",
        answer: COPILOT_SCOPE_MESSAGE,
        meetingId: null,
        meetingTitle: context.meetingTitle,
      };
    }

    const answer = formatCopilotMeetingResponse(intent, context);

    console.info("[copilot-query] meeting response", {
      intent,
      meetingId: context.meetingId,
      taskCount: context.tasks.length,
      remindersSent: context.remindersSent,
    });

    return {
      supported: true,
      intent,
      answer,
      meetingId: context.meetingId,
      meetingTitle: context.meetingTitle,
    };
  });

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useMatch } from "@tanstack/react-router";
import {
  Sparkles,
  Send,
  X,
  FileText,
  ListChecks,
  User,
  Calendar,
  Mail,
  Loader2,
  Clock,
  AlertTriangle,
  BarChart3,
  History,
  TrendingUp,
  Percent,
  Timer,
  Award,
  UserX,
  LineChart,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useAppStore } from "@/store/app-store";
import { useCopilot } from "@/hooks/use-copilot";
import { useIsLargeScreen } from "@/hooks/use-lg-screen";
import {
  COPILOT_SUGGESTIONS,
  suggestionQuery,
} from "@/lib/copilot/intents";
import type { CopilotIntent } from "@/lib/copilot/types";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const MEETING_SUGGESTION_INTENTS: CopilotIntent[] = [
  "meeting_summary",
  "extracted_tasks",
  "task_owners",
  "task_deadlines",
];

const SUGGESTION_ICONS: Record<CopilotIntent, LucideIcon> = {
  meeting_summary: FileText,
  extracted_tasks: ListChecks,
  task_owners: User,
  task_deadlines: Calendar,
  reminder_status: Mail,
  pending_tasks: Clock,
  overdue_tasks: AlertTriangle,
  completion_stats: BarChart3,
  reminder_history: History,
  execution_health: TrendingUp,
  completion_rate: Percent,
  on_time_completion: Award,
  average_completion_time: Timer,
  best_performer: Award,
  most_delayed_owner: UserX,
  weekly_completion_trend: LineChart,
  owner_improvement: TrendingUp,
  owner_decline: TrendingUp,
  execution_bottlenecks: AlertTriangle,
  meetings_most_tasks: ListChecks,
  at_risk_owners: UserX,
  at_risk_tasks: AlertTriangle,
  weekly_focus: Sparkles,
  workload_imbalance: BarChart3,
  executive_briefing: FileText,
};

type CopilotPanelContentProps = {
  meetingId: string | null;
  focusMeetingTitle: string | null;
  showReadyBanner: boolean;
  onClose: () => void;
  onInteraction: () => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
};

function CopilotPanelContent({
  meetingId,
  focusMeetingTitle,
  showReadyBanner,
  onClose,
  onInteraction,
  inputRef,
}: CopilotPanelContentProps) {
  const { messages, submitQuery, isLoading } = useCopilot(meetingId);
  const [draft, setDraft] = useState("");

  const suggestions = useMemo(() => {
    if (meetingId) {
      return COPILOT_SUGGESTIONS.filter((item) =>
        MEETING_SUGGESTION_INTENTS.includes(item.intent),
      );
    }
    return COPILOT_SUGGESTIONS;
  }, [meetingId]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const query = draft.trim();
    if (!query) return;
    setDraft("");
    onInteraction();
    await submitQuery(query);
  }

  function handleSuggestion(intent: CopilotIntent) {
    onInteraction();
    void submitQuery(suggestionQuery(intent));
  }

  const subtitle = meetingId
    ? focusMeetingTitle
      ? `Focused on: ${focusMeetingTitle}`
      : "Focused on: This meeting"
    : "Meeting & task queries";

  return (
    <>
      <div className="flex h-16 shrink-0 items-center gap-2 border-b border-border px-4">
        <div className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-gradient-primary">
          <Sparkles className="h-3.5 w-3.5 text-primary-foreground" />
        </div>
        <div className="min-w-0 flex-1 leading-tight">
          <div className="text-sm font-semibold">AI Copilot</div>
          <div
            className={cn(
              "truncate text-[11px]",
              meetingId ? "font-medium text-primary" : "text-muted-foreground",
            )}
            title={focusMeetingTitle ?? undefined}
          >
            {subtitle}
          </div>
        </div>
        <Button variant="ghost" size="icon" className="ml-auto h-7 w-7 shrink-0" onClick={onClose}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      {showReadyBanner && meetingId && (
        <div className="shrink-0 border-b border-primary/20 bg-primary/5 px-4 py-2 text-center text-xs font-medium text-primary">
          Copilot ready for this meeting
        </div>
      )}

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
        {messages.map((message) => (
          <motion.div
            key={message.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className={
              message.role === "assistant"
                ? `max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-tl-sm px-3 py-2 text-sm ${
                    message.error
                      ? "border border-destructive/30 bg-destructive/10 text-destructive"
                      : "bg-muted"
                  }`
                : "ml-auto max-w-[85%] rounded-2xl rounded-tr-sm bg-gradient-primary px-3 py-2 text-sm text-primary-foreground"
            }
          >
            {message.text}
          </motion.div>
        ))}

        {isLoading && (
          <div className="inline-flex max-w-[85%] items-center gap-2 rounded-2xl rounded-tl-sm bg-muted px-3 py-2 text-sm text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Checking meeting data…
          </div>
        )}
      </div>

      <div className="shrink-0 space-y-2 border-t border-border p-3">
        <div className="flex flex-wrap gap-1.5">
          {suggestions.map((suggestion) => {
            const Icon = SUGGESTION_ICONS[suggestion.intent];
            return (
              <button
                key={suggestion.intent}
                type="button"
                disabled={isLoading}
                onClick={() => handleSuggestion(suggestion.intent)}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1 text-[11px] text-muted-foreground transition hover:border-primary/40 hover:text-foreground disabled:opacity-50"
              >
                <Icon className="h-3 w-3" />
                {suggestion.label}
              </button>
            );
          })}
        </div>
        <form className="flex items-center gap-2" onSubmit={handleSubmit}>
          <Input
            ref={inputRef}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Ask about summaries, tasks, owners…"
            className="flex-1"
            disabled={isLoading}
          />
          <Button
            type="submit"
            size="icon"
            disabled={isLoading || !draft.trim()}
            className="bg-gradient-primary text-primary-foreground hover:opacity-90"
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </>
  );
}

export function CopilotPanel() {
  const {
    copilotOpen,
    toggleCopilot,
    copilotFocusMeetingId,
    copilotFocusMeetingTitle,
    copilotFocusRequestId,
    clearCopilotFocusMeeting,
  } = useAppStore();
  const isLargeScreen = useIsLargeScreen();
  const meetingMatch = useMatch({ from: "/_app/meetings/$id", shouldThrow: false });
  const meetingId = copilotFocusMeetingId ?? meetingMatch?.params.id ?? null;
  const inputRef = useRef<HTMLInputElement>(null);
  const [showReadyBanner, setShowReadyBanner] = useState(false);
  const lastFocusRequestId = useRef(copilotFocusRequestId);

  useEffect(() => {
    if (copilotFocusRequestId === lastFocusRequestId.current) return;
    lastFocusRequestId.current = copilotFocusRequestId;

    if (!copilotFocusMeetingId) return;

    setShowReadyBanner(true);
    const bannerTimer = window.setTimeout(() => setShowReadyBanner(false), 4000);

    const focusTimer = window.setTimeout(() => {
      inputRef.current?.focus();
    }, 100);

    return () => {
      window.clearTimeout(bannerTimer);
      window.clearTimeout(focusTimer);
    };
  }, [copilotFocusRequestId, copilotFocusMeetingId]);

  useEffect(() => {
    if (!copilotOpen) return;

    const focusTimer = window.setTimeout(() => {
      inputRef.current?.focus();
    }, 100);

    return () => window.clearTimeout(focusTimer);
  }, [copilotOpen, isLargeScreen]);

  function handleClose() {
    setShowReadyBanner(false);
    clearCopilotFocusMeeting();
    toggleCopilot();
  }

  function handleInteraction() {
    setShowReadyBanner(false);
  }

  const contentProps: CopilotPanelContentProps = {
    meetingId,
    focusMeetingTitle: copilotFocusMeetingTitle,
    showReadyBanner,
    onClose: handleClose,
    onInteraction: handleInteraction,
    inputRef,
  };

  return (
    <>
      {isLargeScreen && (
        <AnimatePresence>
          {copilotOpen && (
            <motion.aside
              initial={{ x: 360, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 360, opacity: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 28 }}
              className="flex w-80 shrink-0 flex-col border-l border-border bg-card"
            >
              <CopilotPanelContent {...contentProps} />
            </motion.aside>
          )}
        </AnimatePresence>
      )}

      {!isLargeScreen && (
        <Sheet
          open={copilotOpen}
          onOpenChange={(open) => {
            if (!open) handleClose();
            else if (!copilotOpen) toggleCopilot();
          }}
        >
          <SheetContent
            side="right"
            className="flex w-full flex-col gap-0 p-0 sm:max-w-md [&>button]:hidden"
          >
            <CopilotPanelContent {...contentProps} />
          </SheetContent>
        </Sheet>
      )}
    </>
  );
}

import { useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Loader2, Send, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAssistant } from "@/hooks/use-assistant";
import { ASSISTANT_SUGGESTIONS } from "@/lib/assistant/suggestions";
import { cn } from "@/lib/utils";

export function AssistantChat() {
  const { messages, submitQuery, isLoading } = useAssistant();
  const [draft, setDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const query = draft.trim();
    if (!query) return;
    setDraft("");
    await submitQuery(query);
    requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }));
  }

  function handleSuggestion(query: string) {
    void submitQuery(query);
    requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }));
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-4rem)] w-full max-w-3xl flex-col">
      <div className="shrink-0 border-b border-border px-4 py-5 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-primary">
            <Sparkles className="h-4 w-4 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight">MeetFlow Assistant</h1>
            <p className="text-sm text-muted-foreground">
              Ask questions across all your meetings, transcripts, summaries, and action items.
            </p>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-5 sm:px-6">
        {messages.map((message) => (
          <motion.div
            key={message.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              "max-w-[92%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-6",
              message.role === "user"
                ? "ml-auto rounded-tr-sm bg-gradient-primary text-primary-foreground"
                : message.error
                  ? "rounded-tl-sm border border-destructive/30 bg-destructive/10 text-destructive"
                  : "rounded-tl-sm bg-muted text-foreground",
            )}
          >
            {message.text}

            {message.sources && message.sources.length > 0 && (
              <div className="mt-3 border-t border-border/60 pt-3 text-xs text-muted-foreground">
                <div className="mb-1.5 font-medium text-foreground">Referenced meetings</div>
                <ul className="space-y-1">
                  {message.sources.map((source) => (
                    <li key={source.meetingId}>
                      <Link
                        to="/meetings/$id"
                        params={{ id: source.meetingId }}
                        className="text-primary hover:underline"
                      >
                        {source.meetingTitle} ({source.meetingDate})
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </motion.div>
        ))}

        {isLoading && (
          <div className="inline-flex max-w-[92%] items-center gap-2 rounded-2xl rounded-tl-sm bg-muted px-4 py-3 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Searching meetings and generating answer…
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <div className="shrink-0 space-y-3 border-t border-border bg-card/50 px-4 py-4 sm:px-6">
        <div className="flex flex-wrap gap-2">
          {ASSISTANT_SUGGESTIONS.map((suggestion) => (
            <button
              key={suggestion.id}
              type="button"
              disabled={isLoading}
              onClick={() => handleSuggestion(suggestion.query)}
              className="inline-flex items-center rounded-full border border-border bg-background px-3 py-1.5 text-xs text-muted-foreground transition hover:border-primary/40 hover:text-foreground disabled:opacity-50"
            >
              {suggestion.label}
            </button>
          ))}
        </div>

        <form className="flex items-center gap-2" onSubmit={handleSubmit}>
          <Input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Ask across all meetings…"
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
    </div>
  );
}

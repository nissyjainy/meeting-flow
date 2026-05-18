import { AnimatePresence, motion } from "framer-motion";
import { Sparkles, Send, X, Wand2, FileText, ListChecks } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAppStore } from "@/store/app-store";

const suggestions = [
  { icon: FileText, label: "Summarize last meeting" },
  { icon: ListChecks, label: "Open tasks assigned to me" },
  { icon: Wand2, label: "Draft follow-up email to Acme" },
];

const messages = [
  { role: "ai", text: "Hi Daniel — I caught the Q3 roadmap sync. Want me to draft a status update or open the action items?" },
  { role: "user", text: "Show me the open action items from this week." },
  { role: "ai", text: "There are 7 open action items across 3 meetings. The two urgent ones are *Freeze prompt schema* (Marcus, Fri) and *Series B narrative deck* (you, Tue)." },
];

export function CopilotPanel() {
  const { copilotOpen, toggleCopilot } = useAppStore();

  return (
    <AnimatePresence>
      {copilotOpen && (
        <motion.aside
          initial={{ x: 360, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 360, opacity: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 28 }}
          className="hidden lg:flex w-80 shrink-0 flex-col border-l border-border bg-card"
        >
          <div className="flex h-16 items-center gap-2 border-b border-border px-4">
            <div className="grid h-7 w-7 place-items-center rounded-md bg-gradient-primary">
              <Sparkles className="h-3.5 w-3.5 text-primary-foreground" />
            </div>
            <div className="leading-tight">
              <div className="text-sm font-semibold">AI Copilot</div>
              <div className="text-[11px] text-muted-foreground">Always on, context-aware</div>
            </div>
            <Button variant="ghost" size="icon" className="ml-auto h-7 w-7" onClick={toggleCopilot}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {messages.map((m, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className={
                  m.role === "ai"
                    ? "max-w-[85%] rounded-2xl rounded-tl-sm bg-muted px-3 py-2 text-sm"
                    : "ml-auto max-w-[85%] rounded-2xl rounded-tr-sm bg-gradient-primary px-3 py-2 text-sm text-primary-foreground"
                }
              >
                {m.text}
              </motion.div>
            ))}
          </div>

          <div className="border-t border-border p-3 space-y-2">
            <div className="flex flex-wrap gap-1.5">
              {suggestions.map((s) => (
                <button
                  key={s.label}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1 text-[11px] text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
                >
                  <s.icon className="h-3 w-3" />
                  {s.label}
                </button>
              ))}
            </div>
            <form className="flex items-center gap-2">
              <Input placeholder="Ask Copilot anything…" className="flex-1" />
              <Button size="icon" className="bg-gradient-primary text-primary-foreground hover:opacity-90">
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
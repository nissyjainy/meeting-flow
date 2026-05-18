import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { AtSign, Bell, CheckCheck, Sparkles, ListChecks, Video } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAppStore } from "@/store/app-store";
import { useState } from "react";
import { cn } from "@/lib/utils";

const iconMap = { mention: AtSign, task: ListChecks, meeting: Video, summary: Sparkles };

export const Route = createFileRoute("/_app/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications — Northstar" },
      { name: "description", content: "Mentions, reminders and AI updates in one focused inbox." },
    ],
  }),
  component: NotificationsPage,
});

function NotificationsPage() {
  const { notifications, markAllRead, markRead } = useAppStore();
  const [tab, setTab] = useState<"all" | "unread">("all");
  const items = tab === "unread" ? notifications.filter((n) => !n.read) : notifications;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 md:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Notifications</h1>
          <p className="text-sm text-muted-foreground">Stay on top of what your team and Copilot are doing.</p>
        </div>
        <Button variant="outline" size="sm" onClick={markAllRead}>
          <CheckCheck className="mr-1.5 h-3.5 w-3.5" /> Mark all as read
        </Button>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)} className="mt-6">
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="unread">Unread</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card className="mt-4 divide-y divide-border overflow-hidden">
        {items.map((n, i) => {
          const Icon = iconMap[n.type] ?? Bell;
          return (
            <motion.button
              key={n.id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              onClick={() => markRead(n.id)}
              className={cn(
                "flex w-full items-start gap-3 px-4 py-3.5 text-left transition hover:bg-muted/40",
                !n.read && "bg-primary/[0.03]",
              )}
            >
              <div className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-accent text-accent-foreground">
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{n.title}</span>
                  {!n.read && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
                  <span className="ml-auto text-[11px] text-muted-foreground">{n.time}</span>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">{n.description}</p>
              </div>
            </motion.button>
          );
        })}
        {items.length === 0 && (
          <div className="py-16 text-center text-sm text-muted-foreground">You're all caught up ✨</div>
        )}
      </Card>
    </div>
  );
}
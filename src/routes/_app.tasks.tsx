import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Plus, MoreHorizontal, Flag } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAppStore } from "@/store/app-store";
import { useState } from "react";
import type { Task, TaskStatus, TaskPriority } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/tasks")({
  head: () => ({
    meta: [
      { title: "Tasks — Northstar" },
      { name: "description", content: "AI-extracted action items, organized as a kanban board." },
    ],
  }),
  component: TasksPage,
});

const columns: { id: TaskStatus; label: string; tone: string }[] = [
  { id: "todo", label: "To do", tone: "bg-muted-foreground/40" },
  { id: "in-progress", label: "In progress", tone: "bg-primary" },
  { id: "review", label: "In review", tone: "bg-warning" },
  { id: "done", label: "Done", tone: "bg-success" },
];

function TasksPage() {
  const { tasks, moveTask } = useAppStore();
  const [view, setView] = useState<"board" | "list">("board");
  const [dragId, setDragId] = useState<string | null>(null);

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-8 md:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Tasks</h1>
          <p className="text-sm text-muted-foreground">Action items extracted from meetings, organized by stage.</p>
        </div>
        <div className="flex items-center gap-2">
          <Tabs value={view} onValueChange={(v) => setView(v as typeof view)}>
            <TabsList>
              <TabsTrigger value="board">Board</TabsTrigger>
              <TabsTrigger value="list">List</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button size="sm" className="bg-gradient-primary text-primary-foreground hover:opacity-90">
            <Plus className="mr-1.5 h-3.5 w-3.5" /> New task
          </Button>
        </div>
      </div>

      {view === "board" ? (
        <div className="mt-6 grid gap-4 lg:grid-cols-4">
          {columns.map((col) => {
            const colTasks = tasks.filter((t) => t.status === col.id);
            return (
              <div
                key={col.id}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => dragId && moveTask(dragId, col.id)}
                className="flex flex-col rounded-xl border border-border bg-muted/30 p-3"
              >
                <div className="mb-3 flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <span className={cn("h-2 w-2 rounded-full", col.tone)} />
                    <span className="text-sm font-medium">{col.label}</span>
                    <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">{colTasks.length}</Badge>
                  </div>
                  <Button variant="ghost" size="icon" className="h-6 w-6"><Plus className="h-3.5 w-3.5" /></Button>
                </div>
                <div className="space-y-2">
                  {colTasks.map((t, i) => (
                    <motion.div
                      key={t.id}
                      layout
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.02 }}
                      draggable
                      onDragStart={() => setDragId(t.id)}
                      onDragEnd={() => setDragId(null)}
                    >
                      <TaskCard task={t} />
                    </motion.div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <Card className="mt-6 divide-y divide-border overflow-hidden">
          {tasks.map((t) => (
            <div key={t.id} className="flex items-center gap-3 p-3 hover:bg-muted/40">
              <PriorityFlag p={t.priority} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{t.title}</div>
                <div className="truncate text-xs text-muted-foreground">{t.description}</div>
              </div>
              <Badge variant="outline" className="capitalize">{t.status.replace("-", " ")}</Badge>
              <div className="w-24"><Progress value={t.progress} className="h-1" /></div>
              <Avatar className="h-7 w-7"><AvatarFallback className="bg-muted text-xs">{t.assignee}</AvatarFallback></Avatar>
              <span className="w-16 text-right text-xs text-muted-foreground">{t.dueDate}</span>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}

function TaskCard({ task }: { task: Task }) {
  return (
    <Card className="cursor-grab p-3 shadow-card transition-shadow hover:shadow-elegant active:cursor-grabbing">
      <div className="flex items-start justify-between gap-2">
        <PriorityFlag p={task.priority} />
        <Button variant="ghost" size="icon" className="-mr-1 -mt-1 h-6 w-6"><MoreHorizontal className="h-3.5 w-3.5" /></Button>
      </div>
      <div className="mt-1 text-sm font-medium leading-snug">{task.title}</div>
      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{task.description}</p>
      <div className="mt-3">
        <Progress value={task.progress} className="h-1" />
      </div>
      <div className="mt-3 flex flex-wrap gap-1">
        {task.tags.map((t) => <Badge key={t} variant="outline" className="text-[10px]">{t}</Badge>)}
      </div>
      <div className="mt-3 flex items-center justify-between">
        <Avatar className="h-6 w-6"><AvatarFallback className="bg-muted text-[10px]">{task.assignee}</AvatarFallback></Avatar>
        <span className="text-[11px] text-muted-foreground">{task.dueDate}</span>
      </div>
    </Card>
  );
}

function PriorityFlag({ p }: { p: TaskPriority }) {
  const map: Record<TaskPriority, string> = {
    low: "text-muted-foreground",
    medium: "text-primary",
    high: "text-warning",
    urgent: "text-destructive",
  };
  return (
    <span className={cn("inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide", map[p])}>
      <Flag className="h-3 w-3" fill="currentColor" /> {p}
    </span>
  );
}
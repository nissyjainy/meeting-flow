import { createFileRoute } from "@tanstack/react-router";
import { Loader2, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyStateCard } from "@/components/ui/empty-state-card";
import { TasksBoardView } from "@/components/tasks/TasksBoardView";
import { TasksExecutionView } from "@/components/tasks/TasksExecutionView";
import {
  kanbanColumnToStoredStatus,
  logTaskFilterDebug,
  taskMatchesSearch,
  taskMatchesStatusFilter,
  type KanbanColumnId,
  type TaskStatusFilter,
} from "@/components/tasks/task-display";
import { useAllTasks } from "@/hooks/use-all-tasks";
import { useUpdateTaskStatus } from "@/hooks/use-update-task-status";
import { type StoredTaskStatus } from "@/lib/meetings/task-status";
import {
  ACTIVE_TASKS_PREVIEW_LIMIT,
  computeTasksPageMetrics,
  selectActiveTasksForDisplay,
} from "@/lib/tasks/task-execution-view";
import { cn } from "@/lib/utils";
import { pageTitle } from "@/lib/branding";

export const Route = createFileRoute("/_app/tasks")({
  head: () => ({
    meta: [
      { title: pageTitle("Tasks") },
      { name: "description", content: "AI-extracted action items with execution tracking." },
    ],
  }),
  component: TasksPage,
});

const columns: { id: KanbanColumnId; tone: string }[] = [
  { id: "todo", tone: "bg-muted-foreground/40" },
  { id: "in-progress", tone: "bg-primary" },
  { id: "done", tone: "bg-success" },
];

const STATUS_FILTERS: { id: TaskStatusFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "todo", label: "To do" },
  { id: "in-progress", label: "In progress" },
  { id: "done", label: "Done" },
];

function TasksPage() {
  const { data: tasks = [], isLoading, isError } = useAllTasks();
  const updateStatus = useUpdateTaskStatus();
  const [view, setView] = useState<"execution" | "board">("execution");
  const [dragId, setDragId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<TaskStatusFilter>("all");
  const [showAllActive, setShowAllActive] = useState(false);
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null);

  const filteredTasks = useMemo(() => {
    return tasks.filter(
      (task) => taskMatchesStatusFilter(task, statusFilter) && taskMatchesSearch(task, search),
    );
  }, [tasks, search, statusFilter]);

  const metrics = useMemo(() => computeTasksPageMetrics(tasks), [tasks]);

  const rankedFilteredTasks = useMemo(
    () => selectActiveTasksForDisplay(filteredTasks, null),
    [filteredTasks],
  );

  const displayTasks = useMemo(
    () =>
      showAllActive
        ? rankedFilteredTasks
        : rankedFilteredTasks.slice(0, ACTIVE_TASKS_PREVIEW_LIMIT),
    [rankedFilteredTasks, showAllActive],
  );

  useEffect(() => {
    setShowAllActive(false);
  }, [search, statusFilter]);

  const visibleBoardColumns = useMemo(
    () =>
      statusFilter === "all" ? columns : columns.filter((col) => col.id === statusFilter),
    [statusFilter],
  );

  useEffect(() => {
    if (isLoading) return;
    logTaskFilterDebug(statusFilter, tasks, filteredTasks);
  }, [statusFilter, tasks, filteredTasks, isLoading]);

  function handleDrop(columnId: KanbanColumnId) {
    if (!dragId) return;

    updateStatus.mutate({
      taskId: dragId,
      status: kanbanColumnToStoredStatus(columnId),
    });
    setDragId(null);
  }

  async function handleStatusChange(
    taskId: string,
    currentStatus: StoredTaskStatus,
    nextStatus: StoredTaskStatus,
  ) {
    if (nextStatus === currentStatus) return;

    setUpdatingTaskId(taskId);
    try {
      await updateStatus.mutateAsync({ taskId, status: nextStatus });
    } catch (error) {
      console.error("[task-status] execution view update failed", {
        taskId,
        status: nextStatus,
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setUpdatingTaskId(null);
    }
  }

  return (
    <div className="mx-auto min-w-0 max-w-7xl px-4 py-5 md:px-8">
      <header className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-semibold tracking-tight">Tasks</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Action items extracted from meetings.
              <span className="mx-1.5 text-muted-foreground/60">·</span>
              <span className="tabular-nums">
                {isLoading
                  ? "Loading…"
                  : `${filteredTasks.length} of ${tasks.length} task${tasks.length === 1 ? "" : "s"}`}
              </span>
            </p>
          </div>

          <div className="flex w-full shrink-0 items-center sm:w-auto sm:justify-end">
            <Tabs value={view} onValueChange={(value) => setView(value as typeof view)}>
              <TabsList className="h-9 w-full sm:w-auto">
                <TabsTrigger value="execution" className="flex-1 px-3 text-xs sm:flex-none">
                  Execution
                </TabsTrigger>
                <TabsTrigger value="board" className="flex-1 px-3 text-xs sm:flex-none">
                  Board
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-3 shadow-card sm:p-3">
          <div className="relative min-w-0">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search tasks, owners, tags…"
              className="h-9 w-full pl-9 text-sm"
              aria-label="Search tasks"
            />
          </div>

          <div className="mt-2.5 min-w-0">
            <div
              className="flex gap-1 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              role="group"
              aria-label="Filter by status"
            >
              {STATUS_FILTERS.map((filter) => (
                <button
                  key={filter.id}
                  type="button"
                  onClick={() => setStatusFilter(filter.id)}
                  className={cn(
                    "shrink-0 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
                    statusFilter === filter.id
                      ? "border-border bg-background text-foreground shadow-sm"
                      : "border-transparent bg-muted/30 text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                  )}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      {isLoading ? (
        view === "execution" ? (
          <TasksExecutionView
            isLoading
            metrics={{ openTasks: 0, overdue: 0, dueToday: 0, completed: 0 }}
            displayTasks={[]}
            totalFiltered={0}
            showAll={false}
            onToggleShowAll={() => undefined}
          />
        ) : (
          <div className="mt-4 flex items-center justify-center gap-2 rounded-xl border border-border bg-muted/20 px-4 py-16 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Loading tasks…
          </div>
        )
      ) : isError ? (
        <p className="mt-4 rounded-xl border border-border bg-muted/20 px-4 py-12 text-center text-sm text-muted-foreground">
          Could not load tasks. Try refreshing the page.
        </p>
      ) : tasks.length === 0 ? (
        <EmptyStateCard
          className="mt-4"
          title="No tasks found"
          description="Action items will appear here after meeting processing finishes."
        />
      ) : view === "execution" ? (
        <TasksExecutionView
          isLoading={false}
          metrics={metrics}
          displayTasks={displayTasks}
          totalFiltered={filteredTasks.length}
          showAll={showAllActive}
          onToggleShowAll={() => setShowAllActive((current) => !current)}
          updatingTaskId={updatingTaskId}
          onStatusChange={(taskId, currentStatus, nextStatus) =>
            void handleStatusChange(taskId, currentStatus, nextStatus)
          }
        />
      ) : (
        <TasksBoardView
          visibleColumns={visibleBoardColumns}
          filteredTasks={filteredTasks}
          statusFilter={statusFilter}
          dragId={dragId}
          onDragStart={setDragId}
          onDragEnd={() => setDragId(null)}
          onDrop={handleDrop}
        />
      )}
    </div>
  );
}

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TaskTableRow } from "@/components/tasks/TaskTableRow";
import { ACTIVE_TASKS_PREVIEW_LIMIT } from "@/lib/tasks/task-execution-view";
import type { TasksPageMetrics } from "@/lib/tasks/task-execution-view";
import type { MeetingTaskRecord } from "@/lib/meetings/types";
import type { StoredTaskStatus } from "@/lib/meetings/task-status";
import { normalizeStoredStatus } from "@/lib/meetings/task-status";
import { cn } from "@/lib/utils";

type MetricProps = {
  label: string;
  value: number;
  tone?: "default" | "destructive" | "warning";
};

function ExecutionMetric({ label, value, tone = "default" }: MetricProps) {
  return (
    <div className="min-w-0 rounded-lg border border-border/60 bg-muted/20 px-1.5 py-2 text-center sm:px-2">
      <div
        className={cn(
          "text-lg font-semibold tabular-nums leading-none tracking-tight",
          tone === "destructive" && value > 0 && "text-destructive",
          tone === "warning" && value > 0 && "text-warning",
        )}
      >
        {value}
      </div>
      <div
        className="mt-1 line-clamp-2 text-[10px] font-medium leading-snug text-muted-foreground sm:text-[11px]"
        title={label}
      >
        {label}
      </div>
    </div>
  );
}

type TasksExecutionViewProps = {
  isLoading: boolean;
  metrics: TasksPageMetrics;
  displayTasks: MeetingTaskRecord[];
  totalFiltered: number;
  showAll: boolean;
  onToggleShowAll: () => void;
  updatingTaskId?: string | null;
  onStatusChange?: (
    taskId: string,
    currentStatus: StoredTaskStatus,
    nextStatus: StoredTaskStatus,
  ) => void;
};

export function TasksExecutionView({
  isLoading,
  metrics,
  displayTasks,
  totalFiltered,
  showAll,
  onToggleShowAll,
  updatingTaskId = null,
  onStatusChange,
}: TasksExecutionViewProps) {
  const shownCount = displayTasks.length;
  const hasMore = totalFiltered > ACTIVE_TASKS_PREVIEW_LIMIT;

  return (
    <div className="mt-4 space-y-3">
      {isLoading ? (
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4 sm:gap-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-14 rounded-lg" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4 sm:gap-2">
          <ExecutionMetric label="Open Tasks" value={metrics.openTasks} />
          <ExecutionMetric label="Overdue" value={metrics.overdue} tone="destructive" />
          <ExecutionMetric label="Due Today" value={metrics.dueToday} tone="warning" />
          <ExecutionMetric label="Completed" value={metrics.completed} />
        </div>
      )}

      <Card className="min-w-0 overflow-hidden shadow-card">
        <div className="border-b border-border bg-muted/20 px-3 py-2">
          <h2 className="text-sm font-semibold tracking-tight">Active tasks</h2>
        </div>

        <div className="hidden border-b border-border/60 bg-muted/10 px-3 py-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground lg:grid lg:grid-cols-[minmax(0,1fr)_7rem_6.5rem_6.5rem] lg:gap-3">
          <span>Task</span>
          <span>Owner</span>
          <span>Due date</span>
          <span>Status</span>
        </div>

        {isLoading ? (
          <div className="space-y-1 px-3 py-2">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-9 w-full rounded-md" />
            ))}
          </div>
        ) : displayTasks.length === 0 ? (
          <p className="px-3 py-8 text-center text-sm text-muted-foreground">No tasks found</p>
        ) : (
          <ul className="divide-y divide-border/60">
            {displayTasks.map((task) => (
              <li key={task.id}>
                <TaskTableRow
                  task={task}
                  compact
                  updating={updatingTaskId === task.id}
                  onStatusChange={
                    onStatusChange
                      ? (status) =>
                          onStatusChange(task.id, normalizeStoredStatus(task.status), status)
                      : undefined
                  }
                />
              </li>
            ))}
          </ul>
        )}

        {!isLoading && totalFiltered > 0 && (
          <div className="flex flex-col items-start gap-2 border-t border-border/60 bg-muted/10 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground tabular-nums">
              Showing {shownCount} of {totalFiltered} task{totalFiltered === 1 ? "" : "s"}
            </p>
            {hasMore && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 shrink-0 px-3 text-xs"
                onClick={onToggleShowAll}
              >
                {showAll ? "Show top 10" : "View All Tasks"}
              </Button>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}

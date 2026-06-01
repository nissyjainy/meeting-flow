import { Link } from "@tanstack/react-router";
import { ArrowRight, Calendar } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { DashboardPriorityTask, ExecutionSummary } from "@/lib/dashboard/analytics-types";
import { TASK_STATUS_LABELS, type DisplayTaskStatus } from "@/lib/meetings/task-status";
import { cn } from "@/lib/utils";

function taskStatusBadgeClass(status: DisplayTaskStatus): string {
  switch (status) {
    case "overdue":
      return "border-destructive/30 bg-destructive/10 text-destructive";
    case "in_progress":
      return "border-primary/30 bg-primary/10 text-primary";
    case "pending":
      return "border-warning/30 bg-warning/10 text-warning";
    default:
      return "";
  }
}

function formatDueLabel(deadline: string | null): string {
  if (!deadline?.trim()) return "No deadline";
  const trimmed = deadline.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    }
  }
  return trimmed.length > 24 ? `${trimmed.slice(0, 24)}…` : trimmed;
}

type MetricProps = {
  label: string;
  value: number;
  tone?: "default" | "destructive" | "warning";
};

function ExecutionMetric({ label, value, tone = "default" }: MetricProps) {
  return (
    <div className="min-w-0 rounded-lg border border-border/60 bg-muted/20 px-1.5 py-2 text-center sm:px-2 sm:py-2.5">
      <div
        className={cn(
          "text-lg font-semibold tabular-nums leading-none tracking-tight sm:text-xl",
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

function PriorityRow({ task }: { task: DashboardPriorityTask }) {
  const dueLabel = formatDueLabel(task.dueDate);

  return (
    <li className="min-w-0">
      <Link
        to="/meetings/$id"
        params={{ id: task.meetingId }}
        title={task.title}
        className="group flex min-w-0 items-start gap-3 rounded-lg border border-transparent px-2 py-2 transition-colors hover:border-border/60 hover:bg-muted/30"
      >
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-sm font-medium leading-snug text-foreground group-hover:text-primary">
            {task.title}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5 sm:flex-row sm:items-center sm:gap-2">
          <Badge
            variant="outline"
            className={cn(
              "max-w-[6.5rem] truncate text-center text-[10px] font-medium uppercase tracking-wide",
              taskStatusBadgeClass(task.displayStatus),
            )}
            title={TASK_STATUS_LABELS[task.displayStatus]}
          >
            {TASK_STATUS_LABELS[task.displayStatus]}
          </Badge>
          <span
            className="flex max-w-[5.5rem] items-center gap-1 truncate text-[11px] text-muted-foreground sm:max-w-[7rem]"
            title={dueLabel}
          >
            <Calendar className="h-3 w-3 shrink-0" aria-hidden />
            <span className="truncate">{dueLabel}</span>
          </span>
        </div>
      </Link>
    </li>
  );
}

type ExecutionSummaryWidgetProps = {
  isLoading: boolean;
  execution?: ExecutionSummary;
  topPriorities: DashboardPriorityTask[];
  onUpload?: () => void;
  isProcessing?: boolean;
};

export function ExecutionSummaryWidget({
  isLoading,
  execution,
  topPriorities,
  onUpload,
  isProcessing,
}: ExecutionSummaryWidgetProps) {
  const summary = execution ?? {
    totalOpen: 0,
    overdue: 0,
    dueToday: 0,
    completedThisWeek: 0,
  };

  return (
    <section className="mt-6">
      <Card className="overflow-hidden shadow-card">
        <div className="border-b border-border bg-muted/20 px-4 py-3.5 sm:px-5">
          <h2 className="text-base font-semibold tracking-tight">Execution tracking</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Open work, deadlines, and weekly completions
          </p>
        </div>

        <div className="space-y-4 px-4 py-4 sm:px-5">
          {isLoading ? (
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4 sm:gap-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-14 rounded-lg sm:h-16" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4 sm:gap-2">
              <ExecutionMetric label="Open Tasks" value={summary.totalOpen} />
              <ExecutionMetric label="Overdue" value={summary.overdue} tone="destructive" />
              <ExecutionMetric label="Due Today" value={summary.dueToday} tone="warning" />
              <ExecutionMetric label="Completed This Week" value={summary.completedThisWeek} />
            </div>
          )}

          <div className="border-t border-border/60 pt-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">Top priorities</h3>
              {!isLoading && topPriorities.length > 0 && (
                <span className="shrink-0 text-xs text-muted-foreground">
                  {topPriorities.length} shown
                </span>
              )}
            </div>

            {isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, index) => (
                  <Skeleton key={index} className="h-12 w-full rounded-lg" />
                ))}
              </div>
            ) : topPriorities.length === 0 ? (
              <div className="rounded-lg bg-muted/30 px-3 py-6 text-center">
                <p className="text-sm text-muted-foreground">
                  No open tasks yet. Upload a meeting to extract action items.
                </p>
                {onUpload && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    onClick={onUpload}
                    disabled={isProcessing}
                  >
                    Import recording
                  </Button>
                )}
              </div>
            ) : (
              <ul className="divide-y divide-border/40">{topPriorities.map((task) => (
                  <PriorityRow key={task.id} task={task} />
                ))}</ul>
            )}
          </div>

          <div className="flex justify-end border-t border-border/60 pt-3">
            <Button variant="outline" size="sm" asChild className="shrink-0">
              <Link to="/tasks">
                View All Tasks
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </div>
      </Card>
    </section>
  );
}

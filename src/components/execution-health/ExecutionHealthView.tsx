import { Link } from "@tanstack/react-router";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Award,
  Calendar,
  CheckCircle2,
  ListChecks,
  Percent,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { TrendChartCard } from "@/components/analytics/TrendChartCard";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { OwnerInsightHighlight } from "@/lib/analytics/accountability-analytics";
import { formatAverageCompletionTime } from "@/lib/analytics/accountability-analytics";
import type { ExecutionHealthBundle } from "@/lib/execution-health/execution-health";
import type { AtRiskTaskRow } from "@/lib/execution-health/at-risk-tasks";
import { cn } from "@/lib/utils";

type ExecutionHealthViewProps = {
  isLoading: boolean;
  bundle: ExecutionHealthBundle | null;
};

const KPI_GRID_CLASS =
  "grid w-full min-w-0 grid-cols-1 items-stretch gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3";

const INSIGHT_GRID_CLASS =
  "grid w-full min-w-0 grid-cols-1 items-stretch gap-3 md:grid-cols-2 sm:gap-4 xl:grid-cols-4";

type MetricCardProps = {
  title: string;
  value: string;
  support: string;
  icon: LucideIcon;
  tone?: "default" | "success" | "warning" | "destructive";
};

function MetricCard({ title, value, support, icon: Icon, tone = "default" }: MetricCardProps) {
  return (
    <Card className="flex h-[12.5rem] max-h-[13.75rem] min-h-[11.25rem] w-full min-w-0 flex-col overflow-hidden p-4 shadow-card">
      <div
        className={cn(
          "grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-accent text-accent-foreground",
          tone === "success" && "bg-success/10 text-success",
          tone === "warning" && "bg-warning/10 text-warning",
          tone === "destructive" && "bg-destructive/10 text-destructive",
        )}
      >
        <Icon className="h-4 w-4" aria-hidden />
      </div>
      <p className="mt-2.5 text-sm font-medium leading-snug text-muted-foreground">{title}</p>
      <p
        className={cn(
          "mt-0.5 break-words text-lg font-semibold leading-snug text-foreground",
          tone === "success" && "text-success",
          tone === "warning" && "text-warning",
          tone === "destructive" && "text-destructive",
        )}
      >
        {value}
      </p>
      <p className="mt-1.5 break-words text-xs leading-relaxed text-muted-foreground">{support}</p>
    </Card>
  );
}

function InsightCard({
  title,
  insight,
  emptySupport,
}: {
  title: string;
  insight: OwnerInsightHighlight | null;
  emptySupport: string;
}) {
  return (
    <Card className="flex h-[12.5rem] min-w-0 flex-col overflow-hidden p-4 shadow-card">
      <p className="text-sm font-medium text-muted-foreground">{title}</p>
      <p className="mt-2 break-words text-lg font-semibold leading-snug text-foreground">
        {insight?.ownerLabel ?? "None"}
      </p>
      <p className="mt-1.5 break-words text-xs leading-relaxed text-muted-foreground">
        {insight ? `${insight.metricLabel}: ${insight.value}` : emptySupport}
      </p>
    </Card>
  );
}

function healthLabelTone(label: ExecutionHealthBundle["health"]["label"]): MetricCardProps["tone"] {
  switch (label) {
    case "Excellent":
    case "Healthy":
      return "success";
    case "Needs Attention":
      return "warning";
    case "At Risk":
      return "destructive";
    default:
      return "default";
  }
}

function formatDueDate(date: Date): string {
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function AtRiskRow({ row }: { row: AtRiskTaskRow }) {
  const owner = row.owner?.trim() || "Unassigned";
  return (
    <li className="flex min-w-0 flex-col gap-1 border-b border-border/60 py-3 last:border-0 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <p className="min-w-0 break-words text-sm font-medium text-foreground">{row.task}</p>
      <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span>{owner}</span>
        <span className="flex items-center gap-1">
          <Calendar className="h-3 w-3 shrink-0" aria-hidden />
          {formatDueDate(row.dueDate)}
        </span>
      </div>
    </li>
  );
}

function LoadingSkeleton() {
  return (
    <div className="mt-6 space-y-4">
      <div className={KPI_GRID_CLASS}>
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-[12.5rem] rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-40 rounded-xl" />
      <div className={INSIGHT_GRID_CLASS}>
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-[12.5rem] rounded-xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-56 rounded-xl" />
        ))}
      </div>
    </div>
  );
}

export function ExecutionHealthView({ isLoading, bundle }: ExecutionHealthViewProps) {
  if (isLoading) return <LoadingSkeleton />;

  if (!bundle) {
    return (
      <p className="mt-6 rounded-xl border border-border bg-muted/20 px-4 py-12 text-center text-sm text-muted-foreground">
        Could not load execution health data.
      </p>
    );
  }

  const { overview, health, accountability, atRiskTasks, executiveSummary } = bundle;
  const { kpis, insights, charts } = accountability;

  return (
    <div className="mt-6 space-y-4">
      <section>
        <h2 className="mb-3 text-sm font-semibold tracking-tight">Health overview</h2>
        <div className={KPI_GRID_CLASS}>
          <MetricCard
            title="Execution Health Score"
            value={String(overview.healthScore)}
            support={overview.healthLabel}
            icon={Activity}
            tone={healthLabelTone(overview.healthLabel)}
          />
          <MetricCard
            title="Completion Rate"
            value={`${overview.completionRate}%`}
            support="Completed divided by all assigned tasks"
            icon={Percent}
            tone="success"
          />
          <MetricCard
            title="On-Time Completion"
            value={`${overview.onTimeCompletionRate}%`}
            support="Finished by deadline among tasks with due dates"
            icon={Award}
          />
          <MetricCard
            title="Overdue %"
            value={`${overview.overduePercent}%`}
            support="Open overdue tasks as share of all assigned"
            icon={AlertTriangle}
            tone={overview.overduePercent > 20 ? "destructive" : "default"}
          />
          <MetricCard
            title="Open Tasks"
            value={String(overview.openTasks)}
            support="Active tasks not yet completed"
            icon={ListChecks}
          />
          <MetricCard
            title="Completed This Week"
            value={String(overview.completedThisWeek)}
            support="Tasks completed in the current week"
            icon={CheckCircle2}
            tone="warning"
          />
        </div>
      </section>

      <section>
        <Card className="overflow-hidden p-5 shadow-card sm:p-6">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <p className="text-3xl font-semibold tabular-nums tracking-tight">{health.score}</p>
            <p className="text-lg font-medium text-muted-foreground">{health.label}</p>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{health.summaryLine}</p>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Strengths
              </h3>
              <ul className="mt-2 space-y-1.5">
                {health.strengths.map((item) => (
                  <li key={item} className="break-words text-sm text-foreground">
                    • {item}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Risks
              </h3>
              <ul className="mt-2 space-y-1.5">
                {health.risks.map((item) => (
                  <li key={item} className="break-words text-sm text-foreground">
                    • {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Card>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold tracking-tight">Owner health</h2>
        <div className={INSIGHT_GRID_CLASS}>
          <InsightCard
            title="Most Reliable Owner"
            insight={insights.mostReliableOwner}
            emptySupport="No on-time completions with deadlines yet"
          />
          <InsightCard
            title="Most Delayed Owner"
            insight={insights.mostDelayedOwner}
            emptySupport="No delayed or overdue tasks"
          />
          <InsightCard
            title="Best Performer"
            insight={insights.highestCompletionRate}
            emptySupport="No completed tasks by owners yet"
          />
          <InsightCard
            title="Fastest Completer"
            insight={insights.fastestCompleter}
            emptySupport="No tasks with start and completion timestamps"
          />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold tracking-tight">Execution trends</h2>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <TrendChartCard
            title="Weekly Completion Trend"
            description="Tasks completed per week (last 8 weeks)"
            data={charts.weeklyCompletions}
            strokeClass="oklch(0.56 0.21 270)"
          />
          <TrendChartCard
            title="Overdue Trend"
            description="Tasks overdue at each week end"
            data={charts.overdueTrend}
            strokeClass="oklch(0.62 0.24 25)"
          />
          <TrendChartCard
            title="Task Volume Trend"
            description="New tasks created per week"
            data={charts.taskVolumeTrend}
            strokeClass="oklch(0.72 0.18 295)"
          />
        </div>
      </section>

      <section>
        <Card className="overflow-hidden shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/20 px-4 py-3 sm:px-5">
            <div>
              <h2 className="text-sm font-semibold tracking-tight">Tasks at risk</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Open tasks with deadlines in the next 3 days
              </p>
            </div>
            <Button variant="outline" size="sm" asChild className="shrink-0">
              <Link to="/tasks">
                View all
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
          <div className="px-4 py-2 sm:px-5">
            {atRiskTasks.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No tasks at risk in the next three days.
              </p>
            ) : (
              <ul>{atRiskTasks.map((row) => (
                  <AtRiskRow key={row.id} row={row} />
                ))}</ul>
            )}
          </div>
        </Card>
      </section>

      <section>
        <Card className="overflow-hidden p-5 shadow-card sm:p-6">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" aria-hidden />
            <h2 className="text-sm font-semibold tracking-tight">Executive summary</h2>
          </div>
          <div className="mt-3 space-y-3 text-sm leading-relaxed text-muted-foreground">
            {executiveSummary.split("\n\n").map((paragraph) => (
              <p key={paragraph} className="break-words">
                {paragraph}
              </p>
            ))}
          </div>
          <p className="mt-4 break-words text-xs text-muted-foreground/80">
            Average completion time:{" "}
            <span className="font-medium text-foreground">
              {formatAverageCompletionTime(kpis.averageCompletionHours)}
            </span>
            {" · "}
            Completed this month:{" "}
            <span className="font-medium text-foreground">{kpis.tasksCompletedThisMonth}</span>
          </p>
        </Card>
      </section>
    </div>
  );
}

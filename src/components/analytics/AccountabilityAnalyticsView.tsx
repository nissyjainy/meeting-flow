import { Award, Clock, Percent, Timer, type LucideIcon } from "lucide-react";
import { TrendChartCard } from "@/components/analytics/TrendChartCard";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  formatAverageCompletionTime,
  type AccountabilityAnalytics,
  type OwnerInsightHighlight,
} from "@/lib/analytics/accountability-analytics";
import { cn } from "@/lib/utils";

type AccountabilityAnalyticsViewProps = {
  isLoading: boolean;
  analytics: AccountabilityAnalytics | null;
};

const KPI_GRID_CLASS =
  "grid w-full min-w-0 grid-cols-1 items-stretch gap-3 md:grid-cols-2 sm:gap-4 xl:grid-cols-4";

type MetricCardProps = {
  title: string;
  value: string;
  support: string;
  icon: LucideIcon;
  tone?: "default" | "success" | "warning";
};

function MetricCard({ title, value, support, icon: Icon, tone = "default" }: MetricCardProps) {
  return (
    <Card className="flex h-[12.5rem] max-h-[13.75rem] min-h-[11.25rem] w-full min-w-0 flex-col overflow-hidden p-4 shadow-card">
      <div
        className={cn(
          "grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-accent text-accent-foreground",
          tone === "success" && "bg-success/10 text-success",
          tone === "warning" && "bg-warning/10 text-warning",
        )}
      >
        <Icon className="h-4 w-4" aria-hidden />
      </div>
      <p className="mt-2.5 text-sm font-medium leading-snug text-muted-foreground">{title}</p>
      <p
        className={cn(
          "mt-0.5 break-words text-lg font-semibold leading-snug text-foreground",
          tone === "success" && "text-success",
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

function LoadingSkeleton() {
  return (
    <div className="mt-6 space-y-4">
      <div className={KPI_GRID_CLASS}>
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-[12.5rem] rounded-xl" />
        ))}
      </div>
      <div className={KPI_GRID_CLASS}>
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={`insight-${index}`} className="h-[12.5rem] rounded-xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={`chart-${index}`} className="h-56 rounded-xl" />
        ))}
      </div>
    </div>
  );
}

export function AccountabilityAnalyticsView({ isLoading, analytics }: AccountabilityAnalyticsViewProps) {
  if (isLoading) return <LoadingSkeleton />;

  if (!analytics) {
    return (
      <p className="mt-6 rounded-xl border border-border bg-muted/20 px-4 py-12 text-center text-sm text-muted-foreground">
        Could not load accountability analytics.
      </p>
    );
  }

  const { kpis, insights, charts } = analytics;

  return (
    <div className="mt-6 space-y-4">
      <div className={KPI_GRID_CLASS}>
        <MetricCard
          title="Completion Rate"
          value={`${kpis.completionRate}%`}
          support="Completed tasks divided by all assigned tasks"
          icon={Percent}
          tone="success"
        />
        <MetricCard
          title="On-Time Completion"
          value={`${kpis.onTimeCompletionRate}%`}
          support="Completed by deadline among tasks with due dates"
          icon={Award}
        />
        <MetricCard
          title="Average Completion Time"
          value={formatAverageCompletionTime(kpis.averageCompletionHours)}
          support="From started_at to completed_at"
          icon={Timer}
        />
        <MetricCard
          title="Completed This Month"
          value={String(kpis.tasksCompletedThisMonth)}
          support="Tasks completed in the current calendar month"
          icon={Clock}
          tone="warning"
        />
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold tracking-tight">Owner insights</h2>
        <div className={KPI_GRID_CLASS}>
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
            title="Fastest Completer"
            insight={insights.fastestCompleter}
            emptySupport="No tasks with start and completion timestamps"
          />
          <InsightCard
            title="Highest Completion Rate"
            insight={insights.highestCompletionRate}
            emptySupport="No completed tasks by owners yet"
          />
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold tracking-tight">Trends</h2>
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
      </div>
    </div>
  );
}

import { AlertTriangle, ListChecks, Trophy, Users, type LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { TeamInsightsSummary } from "@/lib/tasks/team-insights";
import { cn } from "@/lib/utils";

type TeamInsightsViewProps = {
  isLoading: boolean;
  summary: TeamInsightsSummary | null;
};

/** Dashboard KPI grid: 1 → 2 → 4 columns at md / xl breakpoints. */
const KPI_GRID_CLASS =
  "grid w-full min-w-0 grid-cols-1 items-stretch gap-3 md:grid-cols-2 sm:gap-4 xl:grid-cols-4";

/** Shared column template for header + rows (fixed numeric widths). */
const LEADERBOARD_GRID =
  "grid grid-cols-[minmax(9rem,1.45fr)_5.5rem_5.5rem_4.5rem_5rem_4.5rem] items-center gap-x-4";

type InsightKpiCardProps = {
  title: string;
  value: string;
  support: string;
  icon: LucideIcon;
  index?: number;
  tone?: "default" | "destructive" | "success";
};

function InsightKpiCard({
  title,
  value,
  support,
  icon: Icon,
  index = 0,
  tone = "default",
}: InsightKpiCardProps) {
  return (
    <Card
      className="flex h-[12.5rem] max-h-[13.75rem] min-h-[11.25rem] w-full min-w-0 flex-col overflow-hidden p-4 shadow-card transition-shadow hover:shadow-elegant"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <div
        className={cn(
          "grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-accent text-accent-foreground",
          tone === "destructive" && "bg-destructive/10 text-destructive",
          tone === "success" && "bg-success/10 text-success",
        )}
      >
        <Icon className="h-4 w-4 shrink-0" aria-hidden />
      </div>

      <p className="mt-2.5 text-sm font-medium leading-snug text-muted-foreground">{title}</p>

      <p
        className={cn(
          "mt-0.5 break-words text-lg font-semibold leading-snug tracking-tight text-foreground",
          tone === "destructive" && "text-destructive",
          tone === "success" && "text-success",
        )}
      >
        {value}
      </p>

      <p className="mt-1.5 break-words text-xs leading-relaxed text-muted-foreground">{support}</p>
    </Card>
  );
}

function OwnerInsightsTable({ owners }: { owners: TeamInsightsSummary["owners"] }) {
  return (
    <Card className="min-w-0 overflow-hidden shadow-card">
      <div className="border-b border-border bg-muted/20 px-4 py-3 sm:px-5">
        <h2 className="text-sm font-semibold tracking-tight">Owner leaderboard</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">Sorted by completion rate</p>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[40rem]">
          <div
            className={cn(
              LEADERBOARD_GRID,
              "border-b border-border/60 bg-muted/10 px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground sm:px-5",
            )}
            role="row"
          >
            <span className="sticky left-0 z-10 -ml-4 bg-muted/10 pl-4 sm:-ml-5 sm:pl-5">Owner</span>
            <span className="text-right tabular-nums">Assigned</span>
            <span className="text-right tabular-nums">Completed</span>
            <span className="text-right tabular-nums">Open</span>
            <span className="text-right tabular-nums">Overdue</span>
            <span className="text-right tabular-nums">Rate</span>
          </div>

          <ul className="divide-y divide-border/60" role="list">
            {owners.map((owner) => (
              <li key={owner.ownerKey} role="row" className="group">
                <div
                  className={cn(
                    LEADERBOARD_GRID,
                    "px-4 py-3 transition-colors hover:bg-muted/20 sm:px-5 sm:py-2.5",
                  )}
                >
                  <div
                    className="sticky left-0 z-10 -ml-4 min-w-0 bg-card pl-4 transition-colors group-hover:bg-muted/20 sm:-ml-5 sm:pl-5"
                    title={owner.ownerLabel}
                  >
                    <p className="truncate text-sm font-semibold text-foreground">{owner.ownerLabel}</p>
                  </div>

                  <span className="text-right text-sm tabular-nums text-foreground">{owner.assigned}</span>
                  <span className="text-right text-sm tabular-nums text-foreground">{owner.completed}</span>
                  <span className="text-right text-sm tabular-nums text-muted-foreground">{owner.open}</span>
                  <span
                    className={cn(
                      "text-right text-sm tabular-nums",
                      owner.overdue > 0 ? "font-medium text-destructive" : "text-muted-foreground",
                    )}
                  >
                    {owner.overdue}
                  </span>
                  <span className="text-right text-sm font-semibold tabular-nums text-foreground">
                    {owner.completionRate}%
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Card>
  );
}

function KpiSkeleton() {
  return (
    <div className={KPI_GRID_CLASS}>
      {Array.from({ length: 4 }).map((_, index) => (
        <Skeleton key={index} className="h-[12.5rem] w-full min-w-0 rounded-xl" />
      ))}
    </div>
  );
}

function buildKpiCards(summary: TeamInsightsSummary) {
  const { bestPerformer, mostOverdue, totalOwners, totalAssigned } = summary;

  return [
    {
      key: "best-performer",
      title: "Best Performer",
      value: bestPerformer?.ownerLabel ?? "None",
      support: bestPerformer
        ? `${bestPerformer.completionRate}% Completion Rate`
        : "No assigned tasks yet",
      icon: Trophy,
      tone: "success" as const,
    },
    {
      key: "most-overdue",
      title: "Most Overdue",
      value: mostOverdue?.ownerLabel ?? "None",
      support: mostOverdue
        ? `${mostOverdue.overdue} overdue task${mostOverdue.overdue === 1 ? "" : "s"}`
        : "All owners are on track",
      icon: AlertTriangle,
      tone: mostOverdue ? ("destructive" as const) : ("default" as const),
    },
    {
      key: "total-owners",
      title: "Total Owners",
      value: String(totalOwners),
      support: totalOwners === 1 ? "Owner with assigned tasks" : "Owners with assigned tasks",
      icon: Users,
      tone: "default" as const,
    },
    {
      key: "total-assigned",
      title: "Total Assigned Tasks",
      value: String(totalAssigned),
      support: "Across all owners",
      icon: ListChecks,
      tone: "default" as const,
    },
  ];
}

export function TeamInsightsView({ isLoading, summary }: TeamInsightsViewProps) {
  if (isLoading) {
    return (
      <div className="mt-6 space-y-4">
        <KpiSkeleton />
        <Card className="overflow-hidden shadow-card">
          <div className="space-y-2 px-4 py-3 sm:px-5">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-11 w-full rounded-md" />
            ))}
          </div>
        </Card>
      </div>
    );
  }

  if (!summary) {
    return (
      <p className="mt-6 rounded-xl border border-border bg-muted/20 px-4 py-12 text-center text-sm text-muted-foreground">
        Could not compute team insights.
      </p>
    );
  }

  const { owners } = summary;
  const kpiCards = buildKpiCards(summary);

  return (
    <div className="mt-6 space-y-4">
      <div className={KPI_GRID_CLASS}>
        {kpiCards.map((card, index) => (
          <InsightKpiCard
            key={card.key}
            index={index}
            title={card.title}
            value={card.value}
            support={card.support}
            icon={card.icon}
            tone={card.tone}
          />
        ))}
      </div>

      {owners.length === 0 ? (
        <Card className="px-4 py-12 text-center shadow-card sm:px-6">
          <p className="text-sm text-muted-foreground">
            No assigned tasks yet. Insights will appear after meeting processing extracts action
            items.
          </p>
        </Card>
      ) : (
        <OwnerInsightsTable owners={owners} />
      )}
    </div>
  );
}

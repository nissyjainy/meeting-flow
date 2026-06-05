import { createFileRoute, Link } from "@tanstack/react-router";
import { useRouteContext } from "@tanstack/react-router";
import {
  Video,
  ListChecks,
  AlertTriangle,
  CheckCircle2,
  Mail,
  Sparkles,
  ArrowRight,
  Loader2,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/dashboard/StatCard";
import { ExecutionSummaryWidget } from "@/components/dashboard/ExecutionSummaryWidget";
import { useDashboardAnalytics } from "@/hooks/use-dashboard-analytics";
import { useMeetingUploadTrigger } from "@/providers/meeting-upload-provider";
import { cn } from "@/lib/utils";
import { pageTitle } from "@/lib/branding";

export const Route = createFileRoute("/_app/")({
  head: () => ({
    meta: [
      { title: pageTitle("Dashboard") },
      {
        name: "description",
        content:
          "Your AI-powered meeting workspace: summaries, action items, and team progress at a glance.",
      },
    ],
  }),
  component: Dashboard,
});

function greetingName(fullName: string | null | undefined, email: string): string {
  if (fullName?.trim()) return fullName.trim().split(/\s+/)[0] ?? fullName;
  return email.split("@")[0] ?? "there";
}

const KPI_GRID_CLASS =
  "grid auto-rows-fr grid-cols-2 gap-1.5 sm:grid-cols-3 sm:gap-2 xl:grid-cols-5 lg:gap-3";

function StatCardsSkeleton() {
  return (
    <div className={cn("mt-6", KPI_GRID_CLASS)}>
      {Array.from({ length: 5 }).map((_, index) => (
        <Card key={index} className="flex min-h-[6.75rem] min-w-0 flex-col overflow-hidden p-2.5 shadow-card sm:min-h-[7.25rem] sm:p-3">
          <Skeleton className="h-8 w-8 rounded-lg" />
          <div className="mt-auto space-y-1.5 pt-2">
            <Skeleton className="h-7 w-10" />
            <Skeleton className="h-3 w-full max-w-[5.5rem]" />
          </div>
        </Card>
      ))}
    </div>
  );
}

function Dashboard() {
  const { user } = useRouteContext({ from: "__root__" });
  const { openUploadDialog, isProcessing } = useMeetingUploadTrigger();
  const { data, isLoading, isError, refetch } = useDashboardAnalytics();

  const displayName = user ? greetingName(user.fullName, user.email) : "there";
  const execution = data?.execution;
  const openTaskCount = execution?.totalOpen ?? 0;

  return (
    <div className="mx-auto min-w-0 max-w-7xl px-4 py-8 md:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">Good morning, {displayName}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isLoading ? (
              "Loading your workspace…"
            ) : (
              <>
                <span className="font-medium text-foreground">{openTaskCount} open tasks</span>
                {" · "}
                {data?.totalMeetings ?? 0} meeting{(data?.totalMeetings ?? 0) === 1 ? "" : "s"}
                {(execution?.overdue ?? 0) > 0 && (
                  <>
                    {" · "}
                    <span className="font-medium text-destructive">{execution?.overdue} overdue</span>
                  </>
                )}
                {(execution?.completedThisWeek ?? 0) > 0 && (
                  <>
                    {" · "}
                    <span className="font-medium text-foreground">
                      {execution?.completedThisWeek} completed this week
                    </span>
                  </>
                )}
              </>
            )}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => openUploadDialog()}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <>
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden />
                Processing…
              </>
            ) : (
              "Import recording"
            )}
          </Button>
          <Button
            size="sm"
            className="bg-gradient-primary text-primary-foreground hover:opacity-90"
            asChild
          >
            <Link to="/assistant">
              <Sparkles className="mr-1.5 h-3.5 w-3.5" /> Ask Assistant
            </Link>
          </Button>
        </div>
      </div>

      {isLoading ? (
        <StatCardsSkeleton />
      ) : (
        <>
          {isError && (
            <Card className="mt-6 border-dashed p-4 text-center shadow-none">
              <p className="text-sm text-muted-foreground">
                Some dashboard statistics could not be refreshed.
              </p>
              <Button variant="outline" size="sm" className="mt-2" onClick={() => void refetch()}>
                Retry
              </Button>
            </Card>
          )}
          <div className={cn(KPI_GRID_CLASS, isError ? "mt-3" : "mt-6")}>
            <StatCard label="Total meetings" value={data?.totalMeetings ?? 0} icon={Video} index={0} />
            <StatCard label="Pending tasks" value={data?.pendingTasks ?? 0} icon={ListChecks} index={1} />
            <StatCard
              label="Overdue tasks"
              value={data?.overdueTasks ?? 0}
              icon={AlertTriangle}
              index={2}
            />
            <StatCard
              label="Completed tasks"
              value={data?.completedTasks ?? 0}
              icon={CheckCircle2}
              index={3}
            />
            <StatCard label="Reminders sent" value={data?.remindersSent ?? 0} icon={Mail} index={4} />
          </div>
        </>
      )}

      <ExecutionSummaryWidget
        isLoading={isLoading}
        execution={data?.execution}
        topPriorities={data?.topPriorities ?? []}
        onUpload={() => openUploadDialog()}
        isProcessing={isProcessing}
      />

      <section className="mt-8">
        <Card className="overflow-hidden border-border/80 bg-muted/10 p-4 shadow-none sm:p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Activity this week
              </h2>
              <p className="mt-0.5 text-[11px] text-muted-foreground/80">
                Meetings uploaded and tasks captured
              </p>
            </div>
          </div>
          <div className="mt-3 h-36 w-full min-w-0 sm:h-40">
            {isLoading ? (
              <Skeleton className="h-full w-full rounded-lg" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={data?.weeklyActivity ?? []}
                  margin={{ top: 4, right: 4, left: -24, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="oklch(0.56 0.21 270)" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="oklch(0.56 0.21 270)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="g2" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="oklch(0.72 0.18 295)" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="oklch(0.72 0.18 295)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis
                    dataKey="day"
                    stroke="var(--muted-foreground)"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="var(--muted-foreground)"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                    width={28}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "var(--popover)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="tasks"
                    stroke="oklch(0.72 0.18 295)"
                    strokeWidth={1.5}
                    fill="url(#g2)"
                  />
                  <Area
                    type="monotone"
                    dataKey="meetings"
                    stroke="oklch(0.56 0.21 270)"
                    strokeWidth={1.5}
                    fill="url(#g1)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
      </section>

      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold">Recent meetings</h2>
          <Link
            to="/meetings"
            className="inline-flex shrink-0 items-center gap-1 text-xs text-primary hover:underline"
          >
            View all <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        {isLoading ? (
          <div className="grid gap-3 md:grid-cols-2">
            {Array.from({ length: 2 }).map((_, index) => (
              <Card key={index} className="min-w-0 overflow-hidden p-4 shadow-card">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="mt-2 h-3 w-1/3" />
                <Skeleton className="mt-3 h-10 w-full" />
              </Card>
            ))}
          </div>
        ) : (data?.recentMeetings.length ?? 0) === 0 ? (
          <Card className="p-6 text-center shadow-card sm:p-8">
            <p className="text-sm text-muted-foreground">
              No processed meetings yet. Import a recording to get started.
            </p>
          </Card>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {data?.recentMeetings.map((meeting) => (
              <Link
                key={meeting.id}
                to="/meetings/$id"
                params={{ id: meeting.id }}
                className="block min-w-0"
              >
                <Card className="h-full min-w-0 overflow-hidden p-4 shadow-card transition-shadow hover:shadow-elegant sm:p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="line-clamp-2 text-sm font-medium leading-snug">{meeting.title}</div>
                      <div className="mt-1 text-xs text-muted-foreground">{meeting.date}</div>
                    </div>
                    <Badge variant="secondary" className="max-w-[5rem] shrink-0 truncate">
                      {meeting.recordingType}
                    </Badge>
                  </div>
                  <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                    {meeting.summary ?? "Summary not available yet."}
                  </p>
                  <div className="mt-3 flex items-center justify-end">
                    <span className="text-[11px] text-muted-foreground">
                      {meeting.actionItems} action item{meeting.actionItems === 1 ? "" : "s"}
                    </span>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

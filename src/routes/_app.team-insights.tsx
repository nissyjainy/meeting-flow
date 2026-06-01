import { createFileRoute } from "@tanstack/react-router";
import { TeamInsightsView } from "@/components/team-insights/TeamInsightsView";
import { useAllTasks } from "@/hooks/use-all-tasks";
import { computeTeamInsights } from "@/lib/tasks/team-insights";
import { useMemo } from "react";

export const Route = createFileRoute("/_app/team-insights")({
  head: () => ({
    meta: [
      { title: "Team Insights — Northstar" },
      {
        name: "description",
        content: "Per-owner task accountability metrics from meeting action items.",
      },
    ],
  }),
  component: TeamInsightsPage,
});

function TeamInsightsPage() {
  const { data: tasks = [], isLoading, isError } = useAllTasks();

  const summary = useMemo(() => {
    if (isLoading || isError) return null;
    return computeTeamInsights(tasks);
  }, [tasks, isLoading, isError]);

  return (
    <div className="mx-auto min-w-0 max-w-7xl px-4 py-5 md:px-8">
      <header className="space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">Team Insights</h1>
        <p className="text-sm text-muted-foreground">
          Per-owner accountability from Supabase task data.
          {!isLoading && !isError && (
            <>
              <span className="mx-1.5 text-muted-foreground/60">·</span>
              <span className="tabular-nums">
                {summary?.totalOwners ?? 0} owner{(summary?.totalOwners ?? 0) === 1 ? "" : "s"}
              </span>
            </>
          )}
        </p>
      </header>

      {isError ? (
        <p className="mt-4 rounded-xl border border-border bg-muted/20 px-4 py-12 text-center text-sm text-muted-foreground">
          Could not load tasks. Try refreshing the page.
        </p>
      ) : (
        <TeamInsightsView isLoading={isLoading} summary={summary} />
      )}
    </div>
  );
}

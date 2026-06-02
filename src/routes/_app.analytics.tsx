import { createFileRoute } from "@tanstack/react-router";
import { AccountabilityAnalyticsView } from "@/components/analytics/AccountabilityAnalyticsView";
import { useAccountabilityAnalytics } from "@/hooks/use-accountability-analytics";
import { pageTitle } from "@/lib/branding";

export const Route = createFileRoute("/_app/analytics")({
  head: () => ({
    meta: [
      { title: pageTitle("Analytics") },
      {
        name: "description",
        content: "Accountability analytics from task lifecycle and completion data.",
      },
    ],
  }),
  component: AnalyticsPage,
});

function AnalyticsPage() {
  const { data, isLoading, isError } = useAccountabilityAnalytics();

  return (
    <div className="mx-auto min-w-0 max-w-7xl px-4 py-5 md:px-8">
      <header className="space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">Accountability Analytics</h1>
        <p className="text-sm text-muted-foreground">
          Completion, timing, and owner insights from Supabase task data.
        </p>
      </header>

      {isError ? (
        <p className="mt-6 rounded-xl border border-border bg-muted/20 px-4 py-12 text-center text-sm text-muted-foreground">
          Could not load analytics. Try refreshing the page.
        </p>
      ) : (
        <AccountabilityAnalyticsView isLoading={isLoading} analytics={data ?? null} />
      )}
    </div>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { ExecutionHealthView } from "@/components/execution-health/ExecutionHealthView";
import { useExecutionHealth } from "@/hooks/use-execution-health";
import { pageTitle } from "@/lib/branding";

export const Route = createFileRoute("/_app/execution-health")({
  head: () => ({
    meta: [
      { title: pageTitle("Execution Health") },
      {
        name: "description",
        content: "Manager-focused execution health: score, trends, risks, and owner insights.",
      },
    ],
  }),
  component: ExecutionHealthPage,
});

function ExecutionHealthPage() {
  const { bundle, isLoading, isError, refetch } = useExecutionHealth();

  return (
    <div className="mx-auto min-w-0 max-w-7xl px-4 py-5 md:px-8">
      <header className="space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">Execution Health</h1>
        <p className="text-sm text-muted-foreground">
          Manager view consolidating execution metrics, accountability analytics, and team
          insights.
        </p>
      </header>

      {isError ? (
        <div className="mt-6 rounded-xl border border-border bg-muted/20 px-4 py-12 text-center">
          <p className="text-sm text-muted-foreground">Could not load execution health.</p>
          <button
            type="button"
            className="mt-3 text-sm font-medium text-primary hover:underline"
            onClick={() => void refetch()}
          >
            Retry
          </button>
        </div>
      ) : (
        <ExecutionHealthView isLoading={isLoading} bundle={bundle} />
      )}
    </div>
  );
}

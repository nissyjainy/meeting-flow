import { Calendar, Loader2, RefreshCw, Unplug } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  useDisconnectGoogleCalendar,
  useGoogleCalendarConnection,
  useSyncGoogleCalendar,
} from "@/hooks/use-google-calendar-connection";

function formatTimestamp(value: string | null): string {
  if (!value) return "Never";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Never";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function GoogleCalendarConnect() {
  const { data, isLoading } = useGoogleCalendarConnection();
  const syncCalendar = useSyncGoogleCalendar();
  const disconnectCalendar = useDisconnectGoogleCalendar();

  const configured = data?.configured ?? false;
  const connected = data?.connected ?? false;
  const syncFailed = Boolean(data?.lastSyncError) && !connected;

  return (
    <Card className="p-6 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-muted">
              <Calendar className="h-4 w-4 text-primary" />
            </div>
            <div>
              <div className="text-sm font-semibold">Google Calendar</div>
              <div className="text-xs text-muted-foreground">
                Read-only import of upcoming meetings
              </div>
            </div>
          </div>
        </div>
        {connected ? (
          <span className="rounded-full bg-success/10 px-2.5 py-1 text-xs font-medium text-success">
            Connected
          </span>
        ) : syncFailed ? (
          <span className="rounded-full bg-destructive/10 px-2.5 py-1 text-xs font-medium text-destructive">
            Sync failed
          </span>
        ) : (
          <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
            Not connected
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Checking connection…
        </div>
      ) : !configured ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Google OAuth is not configured on this environment. Add{" "}
          <code className="text-xs">GOOGLE_CLIENT_ID</code> and{" "}
          <code className="text-xs">GOOGLE_CLIENT_SECRET</code> to enable calendar import.
        </p>
      ) : connected ? (
        <div className="mt-4 space-y-4">
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-muted-foreground">Google account</dt>
              <dd className="mt-0.5 truncate font-medium">
                {data?.googleAccountEmail ?? "Connected"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Last synced</dt>
              <dd className="mt-0.5 font-medium">{formatTimestamp(data?.lastSyncedAt ?? null)}</dd>
            </div>
          </dl>

          {data?.lastSyncError ? (
            <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              Last sync error: {data.lastSyncError}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={syncCalendar.isPending}
              onClick={() => {
                void syncCalendar.mutateAsync().then((result) => {
                  if (result.success) {
                    toast.success("Calendar synced", {
                      description: `${result.importedCount} new, ${result.updatedCount} updated`,
                    });
                  } else {
                    toast.error("Sync failed", { description: result.error });
                  }
                });
              }}
            >
              {syncCalendar.isPending ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
              )}
              Sync now
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={disconnectCalendar.isPending}
              onClick={() => {
                void disconnectCalendar.mutateAsync().then((result) => {
                  if (result.success) {
                    toast.message("Google Calendar disconnected");
                  } else {
                    toast.error("Disconnect failed", { description: result.error });
                  }
                });
              }}
            >
              {disconnectCalendar.isPending ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Unplug className="mr-1.5 h-3.5 w-3.5" />
              )}
              Disconnect
            </Button>
          </div>
        </div>
      ) : syncFailed ? (
        <div className="mt-4 space-y-3">
          <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            Calendar connection could not be verified. Last error: {data?.lastSyncError}
          </p>
          <Button type="button" size="sm" asChild className="bg-gradient-primary text-primary-foreground hover:opacity-90">
            <a href="/api/integrations/google/connect">Try connecting again</a>
          </Button>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          <p className="text-sm text-muted-foreground">
            Connect your Google Calendar to import upcoming meetings into the Scheduled tab on
            Meetings. Northstar requests read-only calendar access only.
          </p>
          <Button type="button" size="sm" asChild className="bg-gradient-primary text-primary-foreground hover:opacity-90">
            <a href="/api/integrations/google/connect">Connect Google Calendar</a>
          </Button>
        </div>
      )}
    </Card>
  );
}

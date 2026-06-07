import { Link } from "@tanstack/react-router";
import { ArrowRight, Calendar, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useCalendarEvents } from "@/hooks/use-calendar-events";
import {
  useGoogleCalendarConnection,
  useSyncGoogleCalendar,
} from "@/hooks/use-google-calendar-connection";
import { formatScheduledRange } from "@/lib/calendar/meetings-list";
import {
  calendarLifecycleLabel,
  getCalendarMeetingLifecycle,
  sortCalendarEventsByLifecyclePriority,
} from "@/lib/calendar/meeting-lifecycle";
import type { CalendarMeetingLifecycle } from "@/lib/calendar/meeting-lifecycle";

function lifecycleBadgeClass(status: CalendarMeetingLifecycle): string {
  switch (status) {
    case "upcoming":
      return "bg-primary/10 text-primary hover:bg-primary/10";
    case "in_progress":
      return "bg-warning/15 text-warning hover:bg-warning/15";
    case "completed":
      return "bg-muted text-muted-foreground hover:bg-muted";
    case "cancelled":
      return "bg-destructive/10 text-destructive hover:bg-destructive/10";
  }
}

export function SyncedMeetingsWidget() {
  const { data: connection, isLoading: connectionLoading } = useGoogleCalendarConnection();
  const { data: events = [], isLoading: eventsLoading, refetch } = useCalendarEvents();
  const syncCalendar = useSyncGoogleCalendar();

  const configured = connection?.configured ?? false;
  const connected = connection?.connected ?? false;
  const isLoading = connectionLoading || (connected && eventsLoading);

  const meetEvents = events.filter((event) => event.platform === "Google Meet");
  const preview = sortCalendarEventsByLifecyclePriority(meetEvents).slice(0, 4);

  return (
    <section className="mt-8">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Synced Google Meet meetings</h2>
          <p className="text-xs text-muted-foreground">
            Discovered from Google Calendar — upcoming, in progress, and recent
          </p>
        </div>
        <div className="flex items-center gap-2">
          {connected ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={syncCalendar.isPending}
              onClick={() => {
                void syncCalendar.mutateAsync().then((result) => {
                  if (result.success) {
                    toast.success("Calendar synced");
                    void refetch();
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
              Sync
            </Button>
          ) : null}
          <Link
            to="/meetings"
            className="inline-flex shrink-0 items-center gap-1 text-xs text-primary hover:underline"
          >
            View all <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-3 md:grid-cols-2">
          {Array.from({ length: 2 }).map((_, index) => (
            <Card key={index} className="p-4 shadow-card">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="mt-2 h-3 w-1/2" />
            </Card>
          ))}
        </div>
      ) : !configured ? (
        <Card className="p-6 text-center shadow-card">
          <p className="text-sm text-muted-foreground">
            Google Calendar OAuth is not configured in this environment.
          </p>
        </Card>
      ) : !connected ? (
        <Card className="p-6 text-center shadow-card">
          <p className="text-sm text-muted-foreground">
            Connect Google Calendar to automatically discover Google Meet meetings.
          </p>
          <Button type="button" size="sm" className="mt-3" asChild>
            <Link to="/settings" search={{ tab: "integrations" }}>
              Connect Google Calendar
            </Link>
          </Button>
        </Card>
      ) : preview.length === 0 ? (
        <Card className="p-6 text-center shadow-card">
          <p className="text-sm text-muted-foreground">
            No Google Meet events in your sync window. Try syncing again after your next meeting is
            scheduled.
          </p>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {preview.map((event) => {
            const lifecycle = getCalendarMeetingLifecycle(event);
            const organizer = event.organizer_name ?? event.organizer_email ?? "Unknown organizer";

            return (
              <Link
                key={event.id}
                to="/meetings/scheduled/$id"
                params={{ id: event.id }}
                className="block min-w-0"
              >
                <Card className="h-full p-4 shadow-card transition-shadow hover:shadow-elegant sm:p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="line-clamp-2 text-sm font-medium leading-snug">
                        {event.title}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {formatScheduledRange(event.starts_at, event.ends_at)}
                      </div>
                    </div>
                    <Badge className={lifecycleBadgeClass(lifecycle)}>
                      {calendarLifecycleLabel(lifecycle)}
                    </Badge>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {organizer}
                    </span>
                    {event.meeting_code ? (
                      <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px]">
                        {event.meeting_code}
                      </span>
                    ) : null}
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}

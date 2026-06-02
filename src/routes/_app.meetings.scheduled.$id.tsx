import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, Calendar, Loader2, Upload, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { MeetingLoadErrorView } from "@/components/meetings/MeetingLoadErrorView";
import {
  MeetingJoinButton,
  MeetingPlatformBadge,
} from "@/components/meetings/ScheduledMeetingCard";
import { useCalendarEvent } from "@/hooks/use-calendar-event";
import { formatScheduledRange } from "@/lib/calendar/meetings-list";
import { meetingPlatformLabel } from "@/lib/meetings/detect-meeting-platform";
import { useMeetingUploadTrigger } from "@/providers/meeting-upload-provider";
import { pageTitle } from "@/lib/branding";

export const Route = createFileRoute("/_app/meetings/scheduled/$id")({
  head: () => ({
    meta: [
      { title: pageTitle("Scheduled meeting") },
      { name: "description", content: "Imported Google Calendar event details." },
    ],
  }),
  component: ScheduledMeetingDetailPage,
  notFoundComponent: () => (
    <div className="p-8">
      <p className="text-sm text-muted-foreground">Scheduled meeting not found.</p>
      <Link to="/meetings" className="text-sm text-primary hover:underline">
        Back to meetings
      </Link>
    </div>
  ),
});

function ScheduledMeetingDetailPage() {
  const { id } = Route.useParams();
  const { data: event, isLoading, isError, error, refetch } = useCalendarEvent(id);
  const { openUploadDialog, isProcessing } = useMeetingUploadTrigger();

  if (isLoading) {
    return (
      <article className="mx-auto w-full max-w-4xl px-4 py-6">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="mt-4 h-8 w-2/3" />
        <Skeleton className="mt-2 h-4 w-1/2" />
        <Skeleton className="mt-6 h-40 w-full" />
      </article>
    );
  }

  if (isError) {
    return (
      <MeetingLoadErrorView
        title="Could not load scheduled meeting"
        message={error instanceof Error ? error.message : undefined}
        onRetry={() => void refetch()}
      />
    );
  }

  if (!event) {
    throw notFound();
  }

  const meetingUrl = event.meeting_url ?? event.meet_link;
  const platformLabel = meetingPlatformLabel(event.platform);

  return (
    <article className="mx-auto w-full max-w-4xl px-4 py-6">
      <Link
        to="/meetings"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3 w-3" />
        All meetings
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">{event.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {formatScheduledRange(event.starts_at, event.ends_at)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {event.platform ? <MeetingPlatformBadge platform={event.platform} /> : null}
          <Badge variant="secondary" className="gap-1">
            <Calendar className="h-3 w-3" />
            Scheduled
          </Badge>
        </div>
      </div>

      <Card className="mt-6 space-y-4 p-5 shadow-card">
        {meetingUrl ? (
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {platformLabel}
            </div>
            <div className="mt-2">
              <MeetingJoinButton meetingUrl={meetingUrl} platform={event.platform} />
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No video meeting link detected on this event.
          </p>
        )}

        <div>
          <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <Users className="h-3.5 w-3.5" />
            Attendees ({event.attendees.length})
          </div>
          {event.attendees.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">No attendees listed.</p>
          ) : (
            <ul className="mt-2 divide-y divide-border/60 rounded-lg border border-border/60">
              {event.attendees.map((attendee) => (
                <li key={attendee.email} className="px-3 py-2.5 text-sm">
                  <div className="font-medium">
                    {attendee.displayName ?? attendee.email}
                  </div>
                  {attendee.displayName ? (
                    <div className="text-xs text-muted-foreground">{attendee.email}</div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>

      <Card className="mt-6 p-5 shadow-card">
        <div className="text-sm font-semibold">After the meeting</div>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload a recording to generate transcript, summary, and action items. Scheduled imports
          do not run the AI pipeline until you upload audio or video.
        </p>
        <Button
          type="button"
          size="sm"
          className="mt-4 bg-gradient-primary text-primary-foreground hover:opacity-90"
          onClick={() => openUploadDialog()}
          disabled={isProcessing}
        >
          {isProcessing ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Upload className="mr-1.5 h-3.5 w-3.5" />
          )}
          Upload recording
        </Button>
      </Card>
    </article>
  );
}

import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, FileText, Loader2, Upload, UserRound, Users } from "lucide-react";
import { toast } from "sonner";
import { CalendarLifecycleBadge } from "@/components/meetings/CalendarLifecycleBadge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { MeetingLoadErrorView } from "@/components/meetings/MeetingLoadErrorView";
import {
  MeetingJoinButton,
  MeetingPlatformBadge,
} from "@/components/meetings/ScheduledMeetingCard";
import { useCalendarEvent } from "@/hooks/use-calendar-event";
import { useFetchMeetTranscript } from "@/hooks/use-fetch-meet-transcript";
import { useGoogleCalendarConnection } from "@/hooks/use-google-calendar-connection";
import { formatScheduledRange } from "@/lib/calendar/meetings-list";
import { getCalendarMeetingLifecycle } from "@/lib/calendar/meeting-lifecycle";
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
  const { data: connection } = useGoogleCalendarConnection();
  const fetchTranscript = useFetchMeetTranscript();
  const { openUploadDialog, isProcessing } = useMeetingUploadTrigger();
  const [transcriptText, setTranscriptText] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

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
  const lifecycle = getCalendarMeetingLifecycle(event);
  const isCompleted = lifecycle === "completed";
  const needsReconnect = connection?.needsReconnect ?? false;
  const canFetchTranscript =
    isCompleted && Boolean(event.meeting_code) && connection?.connected && !needsReconnect;

  const handleFetchTranscript = () => {
    setFetchError(null);
    void fetchTranscript.mutateAsync(id).then((result) => {
      if (result.success) {
        setTranscriptText(result.transcript);
        toast.success("Transcript fetched", {
          description: `${result.entryCount} entries from Google Meet`,
        });
        return;
      }

      setTranscriptText(null);
      setFetchError(result.message);

      if (result.code === "needs_reconnect") {
        toast.error("Reconnect required", { description: result.message });
        return;
      }

      toast.error("Could not fetch transcript", { description: result.message });
    });
  };

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
          <CalendarLifecycleBadge event={event} />
        </div>
      </div>

      <Card className="mt-6 space-y-4 p-5 shadow-card">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <UserRound className="h-3.5 w-3.5" />
              Organizer
            </div>
            <p className="mt-2 text-sm font-medium">
              {event.organizer_name ?? event.organizer_email ?? "Not listed"}
            </p>
            {event.organizer_name && event.organizer_email ? (
              <p className="text-xs text-muted-foreground">{event.organizer_email}</p>
            ) : null}
          </div>
          {event.meeting_code ? (
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Meet code
              </div>
              <p className="mt-2 font-mono text-sm">{event.meeting_code}</p>
            </div>
          ) : null}
        </div>

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
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" />
          <div className="text-sm font-semibold">Google Meet transcript</div>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Fetch the transcript from Google Meet after the meeting ends and transcription is
          complete.
        </p>

        {needsReconnect ? (
          <div className="mt-4 rounded-lg border border-warning/40 bg-warning/5 px-3 py-3">
            <p className="text-sm">Reconnect Google to enable transcript capture.</p>
            <Button
              type="button"
              size="sm"
              className="mt-3 bg-gradient-primary text-primary-foreground hover:opacity-90"
              asChild
            >
              <a href="/api/integrations/google/connect">Reconnect Google</a>
            </Button>
          </div>
        ) : !isCompleted ? (
          <p className="mt-4 text-sm text-muted-foreground">
            Transcript fetch is available once this meeting has ended.
          </p>
        ) : !event.meeting_code ? (
          <p className="mt-4 text-sm text-muted-foreground">
            This event has no Google Meet code, so a conference record cannot be matched.
          </p>
        ) : !connection?.connected ? (
          <p className="mt-4 text-sm text-muted-foreground">
            Connect Google Calendar in Settings to fetch transcripts.
          </p>
        ) : (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="mt-4"
            disabled={!canFetchTranscript || fetchTranscript.isPending}
            onClick={handleFetchTranscript}
          >
            {fetchTranscript.isPending ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <FileText className="mr-1.5 h-3.5 w-3.5" />
            )}
            {fetchTranscript.isPending ? "Fetching…" : "Fetch Transcript"}
          </Button>
        )}

        {fetchError ? (
          <p className="mt-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {fetchError}
          </p>
        ) : null}

        {transcriptText ? (
          <ScrollArea className="mt-4 max-h-96 rounded-lg border border-border/60 bg-muted/20 p-4">
            <pre className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
              {transcriptText}
            </pre>
          </ScrollArea>
        ) : null}
      </Card>

      <Card className="mt-6 p-5 shadow-card">
        <div className="text-sm font-semibold">After the meeting</div>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload a recording to run the AI pipeline manually, or use Fetch Transcript above for
          Google Meet native transcripts.
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

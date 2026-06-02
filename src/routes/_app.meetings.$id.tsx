import { useState } from "react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useMeeting, useMeetingPlaybackUrl } from "@/hooks/use-meeting";
import { MeetingDetailLoadingView, MeetingDetailView } from "@/components/meetings/MeetingDetailView";
import { MeetingLoadErrorView } from "@/components/meetings/MeetingLoadErrorView";
import { getPipelineDisplayStatus } from "@/lib/meetings/meeting-display";
import { pageTitle } from "@/lib/branding";

export const Route = createFileRoute("/_app/meetings/$id")({
  head: () => ({
    meta: [
      { title: pageTitle("Meeting") },
      { name: "description", content: "Meeting recording and details." },
    ],
  }),
  component: MeetingDetail,
  notFoundComponent: () => (
    <div className="p-8">
      <p className="text-sm text-muted-foreground">Meeting not found.</p>
      <Link to="/meetings" className="text-sm text-primary hover:underline">
        Back to meetings
      </Link>
    </div>
  ),
});

function MeetingDetail() {
  const { id } = Route.useParams();
  const [reminderStatus, setReminderStatus] = useState<string | null>(null);
  const { data: upload, isLoading, isError, error, refetch } = useMeeting(id);
  const { data: playbackUrl, isLoading: playbackLoading } = useMeetingPlaybackUrl(
    upload?.file_url,
  );

  if (isLoading) {
    return <MeetingDetailLoadingView />;
  }

  if (isError) {
    return (
      <MeetingLoadErrorView
        title="Could not load meeting"
        message={error instanceof Error ? error.message : undefined}
        onRetry={() => void refetch()}
      />
    );
  }

  if (!upload) {
    throw notFound();
  }

  return (
    <MeetingDetailView
      upload={upload}
      pipeline={getPipelineDisplayStatus(upload)}
      playbackUrl={playbackUrl}
      playbackLoading={playbackLoading}
      playbackUnavailable={false}
      reminderStatus={reminderStatus}
      onReminderStatusChange={setReminderStatus}
    />
  );
}

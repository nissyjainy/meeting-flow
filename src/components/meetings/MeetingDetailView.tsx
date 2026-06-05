import { Link } from "@tanstack/react-router";
import { ArrowLeft, Download, Loader2, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatFileSize, formatMeetingDate, fileExtensionLabel } from "@/lib/meetings/validation";
import type { MeetingRecord } from "@/lib/meetings/types";
import type { MeetingPipelineDisplay } from "@/lib/meetings/meeting-display";
import { MeetingPipelineStatus } from "./MeetingPipelineStatus";
import { MeetingResultsCard } from "./MeetingResultsCard";
import {
  MeetingReminderTestButton,
  MeetingReminderTestStatus,
} from "./MeetingReminderTestButton";
import { TeamMembersSection } from "./TeamMembersSection";

export type MeetingDetailViewProps = {
  upload: MeetingRecord;
  pipeline: MeetingPipelineDisplay;
  playbackUrl?: string;
  playbackLoading: boolean;
  playbackUnavailable: boolean;
  reminderStatus: string | null;
  onReminderStatusChange: (status: string | null) => void;
};

export function MeetingDetailView({
  upload,
  pipeline,
  playbackUrl,
  playbackLoading,
  playbackUnavailable,
  reminderStatus,
  onReminderStatusChange,
}: MeetingDetailViewProps) {
  const isVideo = upload.mime_type.startsWith("video/");

  return (
    <article className="mx-auto w-full max-w-7xl px-4 py-6">
      <Link
        to="/meetings"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3 w-3" />
        All meetings
      </Link>

      {/* Header: stacked on mobile, side-by-side on md+ */}
      <div className="mt-4 flex w-full flex-col gap-6 md:flex-row md:items-start md:gap-8">
        <div className="w-full md:flex-1">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">{upload.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            <span className="block truncate" title={upload.file_name}>
              {upload.file_name}
            </span>
          </p>
          <ul className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <li>Uploaded {formatMeetingDate(upload.created_at)}</li>
            {upload.file_size != null && formatFileSize(upload.file_size) && (
              <li>{formatFileSize(upload.file_size)}</li>
            )}
            <li>
              <Badge variant="secondary">{fileExtensionLabel(upload.file_name)}</Badge>
            </li>
            <li>
              <MeetingPipelineStatus status={pipeline} />
            </li>
          </ul>
        </div>

        <div className="w-full md:w-auto">
          <div className="flex flex-wrap gap-2">
            <MeetingReminderTestButton
              meetingId={upload.id}
              onStatusChange={onReminderStatusChange}
            />
            {playbackUrl && (
              <Button variant="outline" size="sm" asChild>
                <a href={playbackUrl} download={upload.file_name}>
                  <Download className="mr-1.5 h-3.5 w-3.5" />
                  Download
                </a>
              </Button>
            )}
            <Button
              size="sm"
              className="bg-gradient-primary text-primary-foreground hover:opacity-90"
              asChild
            >
              <Link to="/assistant" search={{ meetingId: upload.id }}>
                <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                Ask Assistant
              </Link>
            </Button>
          </div>
        </div>
      </div>

      <MeetingReminderTestStatus message={reminderStatus} />

      <Card className="mt-6 w-full p-4 shadow-card">
        {playbackLoading && (
          <div className="flex h-24 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}
        {!playbackLoading && playbackUrl && (
          isVideo ? (
            <video src={playbackUrl} controls className="w-full rounded-lg" />
          ) : (
            <audio src={playbackUrl} controls className="w-full" />
          )
        )}
        {!playbackLoading && !playbackUrl && playbackUnavailable && (
          <p className="py-6 text-center text-sm text-muted-foreground">Recording unavailable.</p>
        )}
      </Card>

      <div className="mt-6 w-full">
        <MeetingResultsCard meeting={upload} />
      </div>

      <div className="mt-6 w-full">
        <TeamMembersSection meetingId={upload.id} />
      </div>
    </article>
  );
}

export function MeetingDetailLoadingView() {
  return (
    <article className="mx-auto w-full max-w-7xl px-4 py-6">
      <Link
        to="/meetings"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3 w-3" />
        All meetings
      </Link>
      <div className="mt-4 space-y-3">
        <Skeleton className="h-8 w-2/3 max-w-md" />
        <Skeleton className="h-4 w-1/2 max-w-sm" />
        <Skeleton className="h-4 w-1/3 max-w-xs" />
      </div>
      <Skeleton className="mt-6 h-40 w-full" />
      <Skeleton className="mt-6 h-64 w-full" />
    </article>
  );
}


import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  AlertCircle,
  ArrowRight,
  FileAudio,
  FileVideo,
  Loader2,
  MoreHorizontal,
  Trash2,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { MeetingRecord } from "@/lib/meetings/types";
import {
  getPipelineDisplayStatus,
  hasSummary,
  summaryFallback,
} from "@/lib/meetings/meeting-display";
import {
  fileExtensionLabel,
  formatFileSize,
  formatMeetingDate,
} from "@/lib/meetings/validation";
import { MeetingPipelineStatus } from "./MeetingPipelineStatus";
import { useDeleteMeeting } from "@/hooks/use-meetings";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type MeetingUploadsListProps = {
  meetings: MeetingRecord[];
  isLoading: boolean;
  isError: boolean;
  errorMessage?: string;
  onRetry?: () => void;
  className?: string;
};

export function MeetingUploadsList({
  meetings,
  isLoading,
  isError,
  errorMessage,
  onRetry,
  className,
}: MeetingUploadsListProps) {
  const deleteMeeting = useDeleteMeeting();

  if (isLoading) {
    return (
      <div className={cn("space-y-3", className)}>
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className="p-4">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="mt-2 h-3 w-1/3" />
          </Card>
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <Card className={cn("flex flex-col items-center gap-3 p-8 text-center", className)}>
        <AlertCircle className="h-8 w-8 text-destructive" />
        <p className="text-sm text-muted-foreground">
          {errorMessage ?? "Could not load uploads."}
        </p>
        {onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry}>
            Try again
          </Button>
        )}
      </Card>
    );
  }

  if (meetings.length === 0) {
    return (
      <Card className={cn("flex flex-col items-center gap-2 p-10 text-center", className)}>
        <FileAudio className="h-10 w-10 text-muted-foreground/50" />
        <p className="text-sm font-medium">No uploads yet</p>
        <p className="max-w-xs text-xs text-muted-foreground">
          Upload an mp3, mp4, wav, or m4a recording to get started.
        </p>
      </Card>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      {meetings.map((meeting, i) => (
        <MeetingUploadRow
          key={meeting.id}
          meeting={meeting}
          index={i}
          isDeleting={deleteMeeting.isPending && deleteMeeting.variables === meeting.id}
          onDelete={async () => {
            try {
              await deleteMeeting.mutateAsync(meeting.id);
              toast.success("Recording deleted");
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "Delete failed");
            }
          }}
        />
      ))}
    </div>
  );
}

function MeetingUploadRow({
  meeting,
  index,
  isDeleting,
  onDelete,
}: {
  meeting: MeetingRecord;
  index: number;
  isDeleting: boolean;
  onDelete: () => void;
}) {
  const isVideo = meeting.mime_type.startsWith("video/");
  const FileIcon = isVideo ? FileVideo : FileAudio;
  const pipeline = getPipelineDisplayStatus(meeting);
  const previewText = hasSummary(meeting)
    ? meeting.summary!
    : summaryFallback(meeting);
  const detailLabel = hasSummary(meeting) ? "Open Summary" : "View Details";

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
    >
      <Card className="group flex flex-col gap-3 p-4 shadow-card transition-shadow hover:shadow-elegant sm:flex-row sm:items-center sm:gap-4">
        <Link
          to="/meetings/$id"
          params={{ id: meeting.id }}
          className="flex min-w-0 flex-1 items-start gap-4 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-gradient-primary/10">
            <FileIcon className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <div className="truncate text-sm font-semibold">{meeting.title}</div>
              <MeetingPipelineStatus status={pipeline} className="shrink-0" />
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
              <span>{formatMeetingDate(meeting.created_at)}</span>
              <span>·</span>
              <span className="truncate" title={meeting.file_name}>
                {meeting.file_name}
              </span>
              {formatFileSize(meeting.file_size) && (
                <>
                  <span>·</span>
                  <span>{formatFileSize(meeting.file_size)}</span>
                </>
              )}
              <span>·</span>
              <span>{fileExtensionLabel(meeting.file_name)}</span>
            </div>
            <p className="mt-1.5 line-clamp-2 text-xs text-muted-foreground">{previewText}</p>
          </div>
        </Link>

        <div className="flex shrink-0 items-center gap-1 self-end sm:self-center">
          <Button type="button" variant="secondary" size="sm" className="gap-1.5" asChild>
            <Link to="/meetings/$id" params={{ id: meeting.id }}>
              {detailLabel}
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <MoreHorizontal className="h-4 w-4" />
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link to="/meetings/$id" params={{ id: meeting.id }}>
                  {detailLabel}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={(e) => {
                  e.preventDefault();
                  onDelete();
                }}
              >
                <Trash2 className="mr-2 h-4 w-4" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </Card>
    </motion.div>
  );
}

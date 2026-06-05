import type { ReactNode } from "react";
import { FileText, ListChecks, Loader2, Sparkles, XCircle } from "lucide-react";
import { MeetingTasksDisplay } from "./MeetingTasksDisplay";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { MeetingRecord } from "@/lib/meetings/types";
import {
  getPipelineDisplayStatus,
  hasSummary,
  hasTranscript,
  summaryFallback,
  transcriptFallback,
} from "@/lib/meetings/meeting-display";
import { MeetingPipelineStatus } from "./MeetingPipelineStatus";
import { MeetingSummaryDisplay } from "./MeetingSummaryDisplay";

type MeetingResultsCardProps = {
  meeting: MeetingRecord;
  isLoading?: boolean;
};

function SectionBlock({
  title,
  icon: Icon,
  description,
  children,
}: {
  title: string;
  icon: typeof Sparkles;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="w-full border-t border-border pt-5 first:border-t-0 first:pt-0">
      <div className="flex w-full items-start gap-3">
        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-muted/60">
          <Icon className="h-4 w-4 text-primary" />
        </div>
        <div className="w-full flex-1">
          <h3 className="text-sm font-semibold">{title}</h3>
          {description && (
            <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
          )}
          <div className="mt-3 w-full">{children}</div>
        </div>
      </div>
    </section>
  );
}

function ProcessingPlaceholder({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-dashed border-border bg-muted/30 px-3 py-3 text-sm text-muted-foreground">
      <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-primary" />
      <span>{message}</span>
    </div>
  );
}

function FailedPlaceholder({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-3 text-sm text-destructive">
      <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

function EmptyFallback({ message }: { message: string }) {
  return (
    <p className="rounded-lg bg-muted/40 px-3 py-3 text-sm text-muted-foreground">{message}</p>
  );
}

export function MeetingResultsCard({ meeting, isLoading }: MeetingResultsCardProps) {
  if (isLoading) {
    return (
      <Card className="p-5 shadow-card">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="mt-4 h-4 w-full" />
        <Skeleton className="mt-2 h-4 w-5/6" />
        <Skeleton className="mt-6 h-24 w-full" />
        <Skeleton className="mt-6 h-32 w-full" />
      </Card>
    );
  }

  const pipeline = getPipelineDisplayStatus(meeting);
  const summaryReady = hasSummary(meeting);
  const transcriptReady = hasTranscript(meeting);
  return (
    <Card className="w-full p-5 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Meeting intelligence</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            AI-generated summary and full transcript from your recording.
          </p>
        </div>
        <MeetingPipelineStatus status={pipeline} />
      </div>

      <div className="mt-5 space-y-0">
        <SectionBlock
          title="Summary"
          icon={Sparkles}
          description={
            summaryReady
              ? "Concise overview of this meeting."
              : pipeline === "processing"
                ? "Summary will appear when processing finishes."
                : undefined
          }
        >
          {pipeline === "failed" && !summaryReady ? (
            <FailedPlaceholder message={summaryFallback(meeting)} />
          ) : pipeline === "processing" && !summaryReady ? (
            <ProcessingPlaceholder message={summaryFallback(meeting)} />
          ) : summaryReady ? (
            <MeetingSummaryDisplay summary={meeting.summary!} />
          ) : (
            <EmptyFallback message={summaryFallback(meeting)} />
          )}
        </SectionBlock>

        <SectionBlock
          title="Action items"
          icon={ListChecks}
          description="Tasks extracted from this meeting transcript."
        >
          <MeetingTasksDisplay meeting={meeting} />
        </SectionBlock>

        <SectionBlock
          title="Transcript"
          icon={FileText}
          description={
            transcriptReady
              ? "Full text from your recording."
              : pipeline === "processing"
                ? "Transcript is being generated."
                : undefined
          }
        >
          {pipeline === "failed" && !transcriptReady ? (
            <FailedPlaceholder message={transcriptFallback(meeting)} />
          ) : pipeline === "processing" && !transcriptReady ? (
            <ProcessingPlaceholder message={transcriptFallback(meeting)} />
          ) : transcriptReady ? (
            <div className="max-h-[min(28rem,50vh)] overflow-y-auto rounded-lg border border-border bg-muted/20 px-3 py-3">
              <p className="whitespace-pre-wrap text-sm leading-6 text-foreground">
                {meeting.transcript_text}
              </p>
            </div>
          ) : (
            <EmptyFallback message={transcriptFallback(meeting)} />
          )}
        </SectionBlock>
      </div>
    </Card>
  );
}

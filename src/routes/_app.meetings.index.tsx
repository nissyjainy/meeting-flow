import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { AlertCircle, Upload, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyStateCard } from "@/components/ui/empty-state-card";
import { ScheduledMeetingCard } from "@/components/meetings/ScheduledMeetingCard";
import { useAllTasks } from "@/hooks/use-all-tasks";
import { useCalendarEvents } from "@/hooks/use-calendar-events";
import { useMeetings } from "@/hooks/use-meetings";
import {
  buildMeetingsListItems,
  listItemMatchesFilter,
  listItemMatchesSearch,
} from "@/lib/calendar/meetings-list";
import type { MeetingFilter } from "@/lib/calendar/types";
import {
  getPipelineDisplayStatus,
  hasSummary,
  summaryFallback,
  type MeetingPipelineDisplay,
} from "@/lib/meetings/meeting-display";
import type { MeetingRecord } from "@/lib/meetings/types";
import {
  fileExtensionLabel,
  formatFileSize,
  formatMeetingDate,
} from "@/lib/meetings/validation";
import { useMeetingUploadTrigger } from "@/providers/meeting-upload-provider";
import { pageTitle } from "@/lib/branding";

export const Route = createFileRoute("/_app/meetings/")({
  validateSearch: (search: Record<string, unknown>) => ({
    upload: search.upload === "1" || search.upload === true || search.upload === "true",
  }),
  head: () => ({
    meta: [
      { title: pageTitle("Meetings") },
      {
        name: "description",
        content: "Every meeting, transcribed and searchable, with AI summaries and action items.",
      },
    ],
  }),
  component: MeetingsPage,
});

function buildTaskCountByMeeting(tasks: { meeting_id: string }[]): Map<string, number> {
  const counts = new Map<string, number>();

  for (const task of tasks) {
    counts.set(task.meeting_id, (counts.get(task.meeting_id) ?? 0) + 1);
  }

  return counts;
}

function meetingDurationLabel(meeting: MeetingRecord): string {
  const fileSize = formatFileSize(meeting.file_size);
  if (fileSize) return fileSize;
  return fileExtensionLabel(meeting.file_name);
}

function MeetingsPage() {
  const navigate = useNavigate();
  const { upload: uploadFromSearch } = Route.useSearch();
  const { openUploadDialog, isProcessing } = useMeetingUploadTrigger();
  const handledUploadSearch = useRef(false);

  useEffect(() => {
    if (!uploadFromSearch) {
      handledUploadSearch.current = false;
      return;
    }
    if (handledUploadSearch.current) return;
    handledUploadSearch.current = true;
    openUploadDialog();
    void navigate({
      to: "/meetings",
      replace: true,
      search: { upload: false },
    });
  }, [uploadFromSearch, openUploadDialog, navigate]);

  const [filter, setFilter] = useState<MeetingFilter>("all");
  const [q, setQ] = useState("");

  const {
    data: meetings = [],
    isLoading: meetingsLoading,
    isError: meetingsError,
    error: meetingsFetchError,
    refetch: refetchMeetings,
  } = useMeetings();
  const {
    data: calendarEvents = [],
    isLoading: calendarLoading,
    isError: calendarError,
    error: calendarFetchError,
    refetch: refetchCalendar,
  } = useCalendarEvents();
  const { data: tasks = [] } = useAllTasks();

  const isLoading = meetingsLoading;
  const isMeetingsError = meetingsError;

  const taskCountByMeeting = useMemo(() => buildTaskCountByMeeting(tasks), [tasks]);

  const listItems = useMemo(
    () => buildMeetingsListItems(meetings, calendarError ? [] : calendarEvents),
    [meetings, calendarEvents, calendarError],
  );

  const filteredItems = useMemo(
    () =>
      listItems.filter(
        (item) => listItemMatchesFilter(item, filter) && listItemMatchesSearch(item, q),
      ),
    [listItems, filter, q],
  );

  const totalCount = listItems.length;

  return (
    <div className="mx-auto min-w-0 max-w-7xl px-4 py-8 md:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Meetings</h1>
          <p className="text-sm text-muted-foreground">
            {isLoading
              ? "Loading meetings…"
              : `${totalCount} meeting${totalCount === 1 ? "" : "s"}`}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button
            type="button"
            size="sm"
            className="bg-gradient-primary text-primary-foreground hover:opacity-90"
            onClick={() => openUploadDialog()}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <Upload className="mr-1.5 h-3.5 w-3.5" aria-hidden />
            )}
            {isProcessing ? "Processing…" : "Upload recording"}
          </Button>
        </div>
      </div>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <Tabs value={filter} onValueChange={(v) => setFilter(v as MeetingFilter)}>
          <TabsList className="flex h-auto w-full flex-wrap justify-start sm:w-auto">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="ready">Ready</TabsTrigger>
            <TabsTrigger value="processing">Processing</TabsTrigger>
            <TabsTrigger value="scheduled">Scheduled</TabsTrigger>
          </TabsList>
        </Tabs>
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by title…"
          className="w-full sm:max-w-xs"
        />
      </div>

      {calendarError && !isMeetingsError ? (
        <Card className="mt-5 flex flex-col gap-2 border-warning/40 bg-warning/5 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Scheduled meetings could not be loaded
            {calendarFetchError instanceof Error ? `: ${calendarFetchError.message}` : "."} Uploaded
            recordings are still shown below.
          </p>
          <Button type="button" variant="outline" size="sm" onClick={() => void refetchCalendar()}>
            Retry calendar
          </Button>
        </Card>
      ) : null}

      {isMeetingsError ? (
        <Card className="mt-5 flex flex-col items-center gap-3 p-10 text-center shadow-card">
          <AlertCircle className="h-8 w-8 text-destructive" />
          <p className="text-sm text-muted-foreground">
            {meetingsFetchError instanceof Error
              ? meetingsFetchError.message
              : "Could not load meetings."}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              void refetchMeetings();
            }}
          >
            Try again
          </Button>
        </Card>
      ) : isLoading ? (
        <MeetingCardGridSkeleton />
      ) : filteredItems.length === 0 ? (
        <EmptyStateCard
          className="mt-5"
          title={
            filter === "scheduled" && totalCount > 0
              ? "No upcoming scheduled meetings"
              : totalCount === 0
                ? "No meetings uploaded"
                : "No meetings match your filters"
          }
          description={
            filter === "scheduled"
              ? "Connect Google Calendar in Settings → Integrations to import upcoming meetings."
              : totalCount === 0
                ? "Upload an mp3, mp4, wav, or m4a recording to get started."
                : "Try a different search or filter."
          }
          action={
            filter === "scheduled" ? (
              <Button variant="outline" size="sm" asChild>
                <Link to="/settings">Open Settings</Link>
              </Button>
            ) : totalCount === 0 ? (
              <Button
                type="button"
                size="sm"
                className="bg-gradient-primary text-primary-foreground hover:opacity-90"
                onClick={() => openUploadDialog()}
                disabled={isProcessing}
              >
                Upload recording
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filteredItems.map((item, i) =>
            item.kind === "scheduled" ? (
              <ScheduledMeetingCard
                key={`scheduled-${item.event.id}`}
                event={item.event}
                index={i}
                taskCount={
                  item.event.linked_meeting_id
                    ? (taskCountByMeeting.get(item.event.linked_meeting_id) ?? 0)
                    : 0
                }
              />
            ) : (
              <UploadMeetingCard
                key={`upload-${item.meeting.id}`}
                meeting={item.meeting}
                index={i}
                taskCount={taskCountByMeeting.get(item.meeting.id) ?? 0}
              />
            ),
          )}
        </div>
      )}
    </div>
  );
}

function UploadMeetingCard({
  meeting,
  index,
  taskCount,
}: {
  meeting: MeetingRecord;
  index: number;
  taskCount: number;
}) {
  const pipeline = getPipelineDisplayStatus(meeting);
  const previewText = hasSummary(meeting) ? meeting.summary! : summaryFallback(meeting);
  const formatLabel = fileExtensionLabel(meeting.file_name);

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
    >
      <Link to="/meetings/$id" params={{ id: meeting.id }}>
        <Card className="group h-full p-5 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-elegant">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="line-clamp-1 text-sm font-semibold">{meeting.title}</div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                {formatMeetingDate(meeting.created_at)} · {meetingDurationLabel(meeting)}
              </div>
            </div>
            <UploadStatusPill status={pipeline} />
          </div>
          <p className="mt-3 line-clamp-2 min-h-[2.5rem] text-xs text-muted-foreground">
            {previewText}
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <Badge variant="outline" className="text-[10px]">
              {formatLabel}
            </Badge>
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
            <div className="flex -space-x-2">
              <Avatar className="h-6 w-6 border-2 border-card">
                <AvatarFallback className="bg-muted text-[10px]">
                  {formatLabel.slice(0, 3)}
                </AvatarFallback>
              </Avatar>
            </div>
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <Sparkles className="h-3 w-3 text-primary" /> {taskCount} action item
              {taskCount === 1 ? "" : "s"}
            </div>
          </div>
        </Card>
      </Link>
    </motion.div>
  );
}

function MeetingCardGridSkeleton() {
  return (
    <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }, (_, index) => (
        <Card key={index} className="p-5 shadow-card">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="mt-2 h-3 w-1/2" />
          <Skeleton className="mt-3 h-10 w-full" />
          <Skeleton className="mt-3 h-5 w-12" />
          <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
            <Skeleton className="h-6 w-6 rounded-full" />
            <Skeleton className="h-3 w-24" />
          </div>
        </Card>
      ))}
    </div>
  );
}

function UploadStatusPill({ status }: { status: MeetingPipelineDisplay }) {
  if (status === "processing") {
    return (
      <Badge variant="secondary" className="gap-1">
        <Loader2 className="h-3 w-3 animate-spin" /> Processing
      </Badge>
    );
  }

  if (status === "failed") {
    return (
      <Badge variant="destructive" className="gap-1">
        Failed
      </Badge>
    );
  }

  return <Badge className="bg-success/15 text-success hover:bg-success/15">Ready</Badge>;
}

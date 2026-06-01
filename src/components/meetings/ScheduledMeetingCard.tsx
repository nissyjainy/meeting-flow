import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Calendar, ExternalLink, Sparkles, Users, Video } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { formatScheduledRange } from "@/lib/calendar/meetings-list";
import type { CalendarEventRecord } from "@/lib/calendar/types";
import {
  meetingPlatformLabel,
  type MeetingPlatform,
} from "@/lib/meetings/detect-meeting-platform";

type ScheduledMeetingCardProps = {
  event: CalendarEventRecord;
  index: number;
  taskCount: number;
};

function resolveMeetingUrl(event: CalendarEventRecord): string | null {
  return event.meeting_url ?? event.meet_link;
}

export function ScheduledMeetingCard({ event, index, taskCount }: ScheduledMeetingCardProps) {
  const attendeePreview = event.attendees.slice(0, 3);
  const remainingAttendees = Math.max(0, event.attendees.length - attendeePreview.length);
  const meetingUrl = resolveMeetingUrl(event);
  const platformLabel = meetingPlatformLabel(event.platform);

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
    >
      <Card className="group h-full p-5 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-elegant">
        <Link to="/meetings/scheduled/$id" params={{ id: event.id }} className="block">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="line-clamp-1 text-sm font-semibold">{event.title}</div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                {formatScheduledRange(event.starts_at, event.ends_at)}
              </div>
            </div>
            <Badge variant="secondary" className="shrink-0 gap-1">
              <Calendar className="h-3 w-3" />
              Scheduled
            </Badge>
          </div>

          <p className="mt-3 line-clamp-2 min-h-[2.5rem] text-xs text-muted-foreground">
            {event.attendees.length > 0
              ? `${event.attendees.length} attendee${event.attendees.length === 1 ? "" : "s"}`
              : "No attendees listed"}
            {meetingUrl ? ` · ${platformLabel} link available` : ""}
          </p>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {meetingUrl && event.platform ? (
              <MeetingPlatformBadge platform={event.platform} />
            ) : null}
            {event.attendees.length > 0 ? (
              <Badge variant="outline" className="gap-1 text-[10px]">
                <Users className="h-3 w-3" />
                {event.attendees.length}
              </Badge>
            ) : null}
          </div>

          <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
            <div className="flex -space-x-2">
              {attendeePreview.map((attendee) => (
                <Avatar key={attendee.email} className="h-6 w-6 border-2 border-card">
                  <AvatarFallback className="bg-muted text-[10px]">
                    {attendee.displayName?.slice(0, 2).toUpperCase() ??
                      attendee.email.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              ))}
              {remainingAttendees > 0 ? (
                <span className="grid h-6 w-6 place-items-center rounded-full border-2 border-card bg-muted text-[10px] text-muted-foreground">
                  +{remainingAttendees}
                </span>
              ) : null}
            </div>
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <Sparkles className="h-3 w-3 text-primary" /> {taskCount} action item
              {taskCount === 1 ? "" : "s"}
            </div>
          </div>
        </Link>

        {meetingUrl ? (
          <div className="mt-3 border-t border-border pt-3">
            <MeetingJoinButton meetingUrl={meetingUrl} platform={event.platform} size="sm" />
          </div>
        ) : null}
      </Card>
    </motion.div>
  );
}

export function MeetingPlatformBadge({ platform }: { platform: MeetingPlatform }) {
  return (
    <Badge variant="outline" className="gap-1 text-[10px]">
      <Video className="h-3 w-3" />
      {meetingPlatformLabel(platform)}
    </Badge>
  );
}

export function MeetingJoinButton({
  meetingUrl,
  platform,
  size = "default",
}: {
  meetingUrl: string;
  platform: MeetingPlatform | null;
  size?: "default" | "sm";
}) {
  const label =
    platform && platform !== "Unknown" ? `Join ${platform}` : "Join Meeting";

  return (
    <Button
      type="button"
      variant="outline"
      size={size}
      className="w-full justify-center gap-1.5 sm:w-auto"
      asChild
    >
      <a href={meetingUrl} target="_blank" rel="noreferrer">
        {label}
        <ExternalLink className="h-3.5 w-3.5" />
      </a>
    </Button>
  );
}

/** @deprecated Use MeetingJoinButton */
export function ScheduledMeetingMeetLink({
  meetLink,
  platform,
}: {
  meetLink: string;
  platform?: MeetingPlatform | null;
}) {
  return <MeetingJoinButton meetingUrl={meetLink} platform={platform ?? null} />;
}

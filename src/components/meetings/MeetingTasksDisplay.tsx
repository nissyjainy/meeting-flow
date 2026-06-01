import { useEffect, useState } from "react";
import { Calendar, Loader2, Mail, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useMeetingTasks } from "@/hooks/use-meeting-tasks";
import { useUpdateMeetingTaskStatus } from "@/hooks/use-update-meeting-task-status";
import type { MeetingRecord, MeetingTaskRecord } from "@/lib/meetings/types";
import { getPipelineDisplayStatus } from "@/lib/meetings/meeting-display";
import {
  STORED_TASK_STATUSES,
  TASK_STATUS_LABELS,
  normalizeStoredStatus,
  resolveTaskBadgeStatus,
  type DisplayTaskStatus,
  type StoredTaskStatus,
} from "@/lib/meetings/task-status";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

type MeetingTasksDisplayProps = {
  meeting: MeetingRecord;
};

type TeamMember = {
  id: string;
  name: string;
  email: string;
};

function normalizeName(value: string | null | undefined): string {
  return value?.trim().toLowerCase() ?? "";
}

function findMemberEmailForOwner(
  owner: string | null | undefined,
  teamMembers: TeamMember[],
): string | null {
  const normalizedOwner = normalizeName(owner);
  if (!normalizedOwner) return null;

  const matched = teamMembers.find(
    (member) => normalizeName(member.name) === normalizedOwner,
  );

  const email = matched?.email?.trim();
  return email || null;
}

function formatDeadline(deadline: string | null): string | null {
  if (!deadline?.trim()) return null;
  const trimmed = deadline.trim();
  const iso = /^\d{4}-\d{2}-\d{2}/.test(trimmed);
  if (!iso) return trimmed;
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return trimmed;
  return parsed.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function statusBadgeClassName(status: DisplayTaskStatus): string {
  switch (status) {
    case "completed":
      return "border-success/30 bg-success/10 text-success";
    case "overdue":
      return "border-destructive/30 bg-destructive/10 text-destructive";
    case "in_progress":
      return "border-primary/30 bg-primary/10 text-primary";
    default:
      return "border-warning/30 bg-warning/10 text-warning";
  }
}

function TaskStatusBadge({ status }: { status: DisplayTaskStatus }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "shrink-0 text-[10px] font-medium uppercase tracking-wide",
        statusBadgeClassName(status),
      )}
    >
      {TASK_STATUS_LABELS[status]}
    </Badge>
  );
}

function TaskCard({
  item,
  ownerEmail,
  displayStatus,
  updating,
  onStatusChange,
}: {
  item: MeetingTaskRecord;
  ownerEmail: string | null;
  displayStatus: DisplayTaskStatus;
  updating: boolean;
  onStatusChange: (status: StoredTaskStatus) => void;
}) {
  const formattedDeadline = formatDeadline(item.deadline);
  const storedStatus = normalizeStoredStatus(item.status);

  return (
    <Card className="flex h-full flex-col border border-border bg-muted/20 p-4 shadow-none">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium leading-snug text-foreground">{item.task}</p>
        <TaskStatusBadge status={displayStatus} />
      </div>

      <div className="mt-3">
        <Select
          value={storedStatus}
          onValueChange={(value) => onStatusChange(value as StoredTaskStatus)}
          disabled={updating}
        >
          <SelectTrigger className="h-8 w-full text-xs">
            <SelectValue placeholder="Set status" />
          </SelectTrigger>
          <SelectContent>
            {STORED_TASK_STATUSES.map((status) => (
              <SelectItem key={status} value={status} className="text-xs">
                {TASK_STATUS_LABELS[status]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {(item.owner || ownerEmail || formattedDeadline) && (
        <ul className="mt-3 space-y-1.5 text-xs text-muted-foreground">
          {item.owner && (
            <li className="flex items-center gap-1.5">
              <User className="h-3.5 w-3.5 shrink-0 text-primary/80" />
              <span>
                <span className="font-medium text-foreground/80">Owner:</span> {item.owner}
              </span>
            </li>
          )}
          {ownerEmail && (
            <li className="flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5 shrink-0 text-primary/80" />
              <span>
                <span className="font-medium text-foreground/80">Email:</span>{" "}
                <a
                  href={`mailto:${ownerEmail}`}
                  className="text-muted-foreground hover:text-foreground hover:underline"
                >
                  {ownerEmail}
                </a>
              </span>
            </li>
          )}
          {formattedDeadline && (
            <li className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 shrink-0 text-primary/80" />
              <span>
                <span className="font-medium text-foreground/80">Deadline:</span>{" "}
                {formattedDeadline}
              </span>
            </li>
          )}
        </ul>
      )}
    </Card>
  );
}

function TasksLoadingSkeleton() {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {[0, 1].map((i) => (
        <Skeleton key={i} className="h-24 w-full rounded-lg" />
      ))}
    </div>
  );
}

export function MeetingTasksDisplay({ meeting }: MeetingTasksDisplayProps) {
  const pipeline = getPipelineDisplayStatus(meeting);
  const pollWhileProcessing = pipeline === "processing";
  const supabase = createClient();
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null);
  const updateTaskStatus = useUpdateMeetingTaskStatus(meeting.id);

  useEffect(() => {
    let cancelled = false;

    async function fetchTeamMembers() {
      const { data, error } = await supabase
        .from("team_members")
        .select("id, name, email")
        .eq("meeting_id", meeting.id)
        .order("created_at", { ascending: true });

      if (cancelled) return;

      if (error) {
        console.error("Failed to load team members for task mapping:", error.message);
        setTeamMembers([]);
        return;
      }

      setTeamMembers(
        (data ?? []).map((row) => ({
          id: String(row.id),
          name: row.name ?? "",
          email: row.email ?? "",
        })),
      );
    }

    void fetchTeamMembers();

    return () => {
      cancelled = true;
    };
  }, [meeting.id]);

  const { data: tasks = [], isLoading, isError } = useMeetingTasks(meeting.id, {
    pollWhileProcessing,
  });

  useEffect(() => {
    if (tasks.length === 0) return;

    console.info(
      "[task-status] tasks in UI",
      tasks.map((task) => ({
        taskId: task.id,
        storedStatus: task.status,
        badgeStatus: resolveTaskBadgeStatus(task.status, task.deadline),
      })),
    );
  }, [tasks]);

  async function handleStatusChange(
    taskId: string,
    currentStatus: StoredTaskStatus,
    nextStatus: StoredTaskStatus,
  ) {
    console.info("[task-status] selected", { taskId, currentStatus, nextStatus });

    if (nextStatus === currentStatus) {
      console.info("[task-status] skipped — unchanged", { taskId, status: nextStatus });
      return;
    }

    setUpdatingTaskId(taskId);
    try {
      await updateTaskStatus.mutateAsync({ taskId, status: nextStatus });
    } catch (error) {
      console.error("[task-status] UI update failed", {
        taskId,
        status: nextStatus,
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setUpdatingTaskId(null);
    }
  }

  if (isLoading) {
    return <TasksLoadingSkeleton />;
  }

  if (isError) {
    return (
      <p className="rounded-lg bg-muted/40 px-3 py-3 text-sm text-muted-foreground">
        Could not load action items. Try refreshing the page.
      </p>
    );
  }

  if (tasks.length === 0) {
    if (pollWhileProcessing) {
      return (
        <div className="flex items-start gap-2 rounded-lg border border-dashed border-border bg-muted/30 px-3 py-3 text-sm text-muted-foreground">
          <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-primary" />
          <span>Action items will appear after processing finishes.</span>
        </div>
      );
    }

    return (
      <p className="rounded-lg bg-muted/40 px-3 py-3 text-sm text-muted-foreground">
        No action items detected
      </p>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {tasks.map((item) => (
        <TaskCard
          key={item.id}
          item={item}
          ownerEmail={findMemberEmailForOwner(item.owner, teamMembers)}
          displayStatus={resolveTaskBadgeStatus(item.status, item.deadline)}
          updating={updatingTaskId === item.id}
          onStatusChange={(status) =>
            void handleStatusChange(item.id, normalizeStoredStatus(item.status), status)
          }
        />
      ))}
    </div>
  );
}

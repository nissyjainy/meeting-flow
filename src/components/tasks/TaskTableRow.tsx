import { Calendar, Loader2, User } from "lucide-react";

import { Badge } from "@/components/ui/badge";

import {

  Select,

  SelectContent,

  SelectItem,

  SelectTrigger,

  SelectValue,

} from "@/components/ui/select";

import {

  formatDueDateLabel,

  ownerLabel,

  resolveTaskDisplayStatus,

  taskDisplayStatusLabel,

  taskStatusBadgeClassName,

} from "@/components/tasks/task-display";

import type { MeetingTaskRecord } from "@/lib/meetings/types";

import {

  normalizeStoredStatus,

  STORED_TASK_STATUSES,

  TASK_STATUS_LABELS,

  type StoredTaskStatus,

} from "@/lib/meetings/task-status";

import { cn } from "@/lib/utils";



export function TaskStatusBadge({ task }: { task: MeetingTaskRecord }) {

  const displayStatus = resolveTaskDisplayStatus(task);

  const label = taskDisplayStatusLabel(task);



  return (

    <Badge

      variant="outline"

      className={cn(

        "inline-flex shrink-0 whitespace-nowrap text-[10px] font-medium uppercase tracking-wide",

        taskStatusBadgeClassName(displayStatus),

      )}

      title={label}

    >

      {label}

    </Badge>

  );

}



type TaskStatusSelectProps = {

  task: MeetingTaskRecord;

  updating?: boolean;

  onStatusChange: (status: StoredTaskStatus) => void;

};



function TaskStatusSelect({ task, updating = false, onStatusChange }: TaskStatusSelectProps) {

  const storedStatus = normalizeStoredStatus(task.status);

  const displayStatus = resolveTaskDisplayStatus(task);



  return (

    <div className="relative flex min-w-0 max-w-[6.5rem] items-center">

      <Select

        value={storedStatus}

        onValueChange={(value) => onStatusChange(value as StoredTaskStatus)}

        disabled={updating}

      >

        <SelectTrigger

          className={cn(

            "h-7 w-full min-w-0 border px-2 text-[10px] font-medium uppercase tracking-wide shadow-none focus:ring-1",

            taskStatusBadgeClassName(displayStatus),

            updating && "opacity-60",

          )}

          aria-label={`Status for ${task.task}`}

        >

          <SelectValue />

        </SelectTrigger>

        <SelectContent align="end">

          {STORED_TASK_STATUSES.map((status) => (

            <SelectItem key={status} value={status} className="text-xs">

              {TASK_STATUS_LABELS[status]}

            </SelectItem>

          ))}

        </SelectContent>

      </Select>

      {updating && (

        <Loader2

          className="pointer-events-none absolute -right-4 h-3 w-3 animate-spin text-muted-foreground"

          aria-hidden

        />

      )}

    </div>

  );

}



type TaskTableRowProps = {

  task: MeetingTaskRecord;

  compact?: boolean;

  updating?: boolean;

  onStatusChange?: (status: StoredTaskStatus) => void;

};



export function TaskTableRow({

  task,

  compact = false,

  updating = false,

  onStatusChange,

}: TaskTableRowProps) {

  const dueLabel = formatDueDateLabel(task.deadline);

  const owner = ownerLabel(task.owner);



  return (

    <div

      className={cn(

        "grid min-w-0 gap-2 px-3 transition-colors hover:bg-muted/30 lg:grid-cols-[minmax(0,1fr)_7rem_6.5rem_6.5rem] lg:items-center lg:gap-3",

        compact ? "py-2 lg:py-1.5" : "py-2.5 lg:py-2",

      )}

    >

      <div className="min-w-0">

        <p className="line-clamp-1 text-sm font-medium leading-snug" title={task.task}>

          {task.task}

        </p>

      </div>



      <div className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground lg:block">

        <span className="w-10 shrink-0 font-medium text-foreground/70 lg:hidden">Owner</span>

        <span className="flex min-w-0 items-center gap-1 lg:min-w-0">

          <User className="hidden h-3 w-3 shrink-0 lg:inline" aria-hidden />

          <span className="truncate" title={owner}>

            {owner}

          </span>

        </span>

      </div>



      <div className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground lg:block">

        <span className="w-10 shrink-0 font-medium text-foreground/70 lg:hidden">Due</span>

        <span className="flex min-w-0 items-center gap-1 lg:min-w-0">

          <Calendar className="hidden h-3 w-3 shrink-0 lg:inline" aria-hidden />

          <span className="truncate" title={dueLabel}>

            {dueLabel}

          </span>

        </span>

      </div>



      <div className="flex min-w-0 items-center gap-2 lg:justify-start">

        <span className="w-10 shrink-0 font-medium text-foreground/70 lg:hidden">Status</span>

        {onStatusChange ? (

          <TaskStatusSelect task={task} updating={updating} onStatusChange={onStatusChange} />

        ) : (

          <TaskStatusBadge task={task} />

        )}

      </div>

    </div>

  );

}


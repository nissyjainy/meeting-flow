import { motion } from "framer-motion";
import { useState } from "react";
import { Calendar, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { TaskStatusBadge } from "@/components/tasks/TaskTableRow";
import {
  formatDueDateLabel,
  kanbanColumnLabel,
  ownerLabel,
  taskMatchesKanbanColumn,
} from "@/components/tasks/task-display";
import type { MeetingTaskRecord } from "@/lib/meetings/types";
import { cn } from "@/lib/utils";
import type { KanbanColumnId, TaskStatusFilter } from "@/components/tasks/task-display";

type BoardColumn = { id: KanbanColumnId; tone: string };

const COLUMN_PREVIEW_LIMIT = 5;

type TasksBoardViewProps = {
  visibleColumns: BoardColumn[];
  filteredTasks: MeetingTaskRecord[];
  statusFilter: TaskStatusFilter;
  dragId: string | null;
  onDragStart: (taskId: string) => void;
  onDragEnd: () => void;
  onDrop: (columnId: KanbanColumnId) => void;
};

export function TasksBoardView({
  visibleColumns,
  filteredTasks,
  statusFilter,
  dragId,
  onDragStart,
  onDragEnd,
  onDrop,
}: TasksBoardViewProps) {
  const [expandedColumns, setExpandedColumns] = useState<Set<KanbanColumnId>>(new Set());

  function toggleColumnExpanded(columnId: KanbanColumnId) {
    setExpandedColumns((current) => {
      const next = new Set(current);
      if (next.has(columnId)) {
        next.delete(columnId);
      } else {
        next.add(columnId);
      }
      return next;
    });
  }

  return (
    <div
      className={cn(
        "mt-4 grid min-w-0 gap-3",
        statusFilter === "all" ? "sm:grid-cols-2 xl:grid-cols-3" : "grid-cols-1",
      )}
    >
      {visibleColumns.map((col) => {
        const colTasks = filteredTasks.filter((task) => taskMatchesKanbanColumn(task, col.id));
        const totalCount = colTasks.length;
        const isExpanded = expandedColumns.has(col.id);
        const visibleTasks =
          isExpanded || totalCount <= COLUMN_PREVIEW_LIMIT
            ? colTasks
            : colTasks.slice(0, COLUMN_PREVIEW_LIMIT);
        const hiddenCount = totalCount - COLUMN_PREVIEW_LIMIT;
        const showToggle = totalCount > COLUMN_PREVIEW_LIMIT;

        return (
          <section
            key={col.id}
            onDragOver={(event) => event.preventDefault()}
            onDrop={() => onDrop(col.id)}
            className="flex min-w-0 flex-col rounded-xl border border-border bg-muted/20 p-3"
          >
            <div className="mb-3 flex min-w-0 items-center gap-2 border-b border-border/60 pb-2.5">
              <span className={cn("h-2 w-2 shrink-0 rounded-full", col.tone)} />
              <span className="min-w-0 truncate text-sm font-medium">{kanbanColumnLabel(col.id)}</span>
              <Badge variant="secondary" className="ml-auto h-5 shrink-0 px-1.5 text-[10px] tabular-nums">
                {colTasks.length}
              </Badge>
            </div>

            <div className="flex min-w-0 flex-col gap-2.5">
              {totalCount === 0 ? (
                <p className="rounded-lg border border-dashed border-border/80 px-3 py-8 text-center text-xs text-muted-foreground">
                  No tasks found
                </p>
              ) : (
                visibleTasks.map((task, index) => (
                  <motion.div
                    key={task.id}
                    layout
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.02 }}
                    draggable
                    onDragStart={() => onDragStart(task.id)}
                    onDragEnd={onDragEnd}
                    className="min-w-0"
                  >
                    <TaskCard task={task} isDragging={dragId === task.id} />
                  </motion.div>
                ))
              )}

              {showToggle ? (
                <div className="mt-1 space-y-2 border-t border-border/60 pt-2">
                  {!isExpanded ? (
                    <p className="text-center text-xs text-muted-foreground">
                      +{hiddenCount} more task{hiddenCount === 1 ? "" : "s"}
                    </p>
                  ) : null}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 w-full text-xs"
                    onClick={() => toggleColumnExpanded(col.id)}
                  >
                    {isExpanded ? "Show less" : "View more"}
                  </Button>
                </div>
              ) : null}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function TaskCard({ task, isDragging }: { task: MeetingTaskRecord; isDragging: boolean }) {
  const dueLabel = formatDueDateLabel(task.deadline);
  const owner = ownerLabel(task.owner);

  return (
    <Card
      className={cn(
        "flex min-h-[6.5rem] min-w-0 cursor-grab flex-col overflow-hidden p-3 shadow-card transition-shadow hover:shadow-elegant active:cursor-grabbing",
        isDragging && "opacity-60",
      )}
    >
      <div className="min-w-0 flex-1">
        <h3 className="line-clamp-2 text-sm font-medium leading-snug text-foreground" title={task.task}>
          {task.task}
        </h3>
      </div>

      <div className="mt-2.5 space-y-2 border-t border-border/60 pt-2">
        <div className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
          <User className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span className="min-w-0 truncate" title={owner}>
            {owner}
          </span>
        </div>

        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
          <span
            className="flex min-w-0 items-center gap-1 text-[11px] text-muted-foreground"
            title={dueLabel}
          >
            <Calendar className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className="truncate">{dueLabel}</span>
          </span>
          <TaskStatusBadge task={task} />
        </div>
      </div>
    </Card>
  );
}

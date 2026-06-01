import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertCircle,
  AtSign,
  Bell,
  ChevronDown,
  ListChecks,
  Sparkles,
  Video,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { AppNotification } from "@/lib/notifications/types";
import {
  buildNotificationSections,
  buildTodaySummary,
  filterNotificationsByTab,
  getRowNotificationIds,
  sliceNotificationSections,
  type NotificationRow,
  type NotificationTab,
  type TodayNotificationSummary,
} from "@/lib/notifications/present-notifications";
import { cn } from "@/lib/utils";

const INITIAL_VISIBLE_COUNT = 10;
const PAGE_SIZE = 10;

const iconMap = { mention: AtSign, task: ListChecks, meeting: Video, summary: Sparkles };

const SUMMARY_LABELS: Array<{ key: keyof TodayNotificationSummary; label: string }> = [
  { key: "tasks_completed", label: "Tasks Completed" },
  { key: "tasks_updated", label: "Tasks Updated" },
  { key: "reminder_sends", label: "Reminder Sends" },
  { key: "meeting_events", label: "Meeting Events" },
];

type NotificationsListProps = {
  notifications: AppNotification[];
  tab: NotificationTab;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  onRetry: () => void;
  onMarkRead: (id: string) => void;
};

export function NotificationsList({
  notifications,
  tab,
  isLoading,
  isError,
  error,
  onRetry,
  onMarkRead,
}: NotificationsListProps) {
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE_COUNT);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  useEffect(() => {
    setVisibleCount(INITIAL_VISIBLE_COUNT);
    setExpandedGroups(new Set());
  }, [tab]);

  const filtered = useMemo(
    () => filterNotificationsByTab(notifications, tab),
    [notifications, tab],
  );

  const todaySummary = useMemo(() => buildTodaySummary(filtered), [filtered]);

  const sections = useMemo(() => buildNotificationSections(filtered), [filtered]);

  const paged = useMemo(
    () => sliceNotificationSections(sections, visibleCount),
    [sections, visibleCount],
  );

  function toggleGroup(groupId: string) {
    setExpandedGroups((current) => {
      const next = new Set(current);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  }

  function handleRowActivate(row: NotificationRow) {
    for (const id of getRowNotificationIds(row)) {
      onMarkRead(id);
    }
  }

  if (isError) {
    return (
      <Card className="mt-4 flex flex-col items-center gap-3 p-10 text-center">
        <AlertCircle className="h-8 w-8 text-destructive" />
        <p className="text-sm text-muted-foreground">
          {error instanceof Error ? error.message : "Could not load notifications."}
        </p>
        <Button variant="outline" size="sm" onClick={onRetry}>
          Try again
        </Button>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <>
        <Card className="mt-4 grid grid-cols-2 gap-3 p-4 sm:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-14" />
          ))}
        </Card>
        <Card className="mt-4 divide-y divide-border overflow-hidden">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="flex items-start gap-3 px-4 py-3.5">
              <Skeleton className="h-8 w-8 rounded-lg" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-3 w-3/4" />
              </div>
            </div>
          ))}
        </Card>
      </>
    );
  }

  return (
    <>
      <Card className="mt-4 p-4 shadow-card">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Today</p>
        <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {SUMMARY_LABELS.map(({ key, label }) => (
            <div
              key={key}
              className="rounded-lg border border-border/60 bg-muted/10 px-3 py-2.5"
            >
              <dt className="text-[11px] text-muted-foreground">{label}</dt>
              <dd className="mt-1 text-lg font-semibold tabular-nums text-foreground">
                {todaySummary[key]}
              </dd>
            </div>
          ))}
        </dl>
      </Card>

      {paged.sections.length === 0 ? (
        <Card className="mt-4 flex flex-col items-center justify-center px-4 py-16 text-center shadow-card">
          <p className="text-sm font-medium text-foreground">
            {tab === "unread" ? "No unread notifications" : "No activity yet"}
          </p>
          <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
            {tab === "unread"
              ? "You're all caught up on unread items."
              : "Meeting updates, task changes, and reminders will show up here."}
          </p>
        </Card>
      ) : (
        <div className="mt-4 space-y-4">
          {paged.sections.map((section) => (
            <div key={section.dateBucket}>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {section.label}
              </h2>
              <Card className="divide-y divide-border overflow-hidden shadow-card">
                {section.rows.map((row, index) => (
                  <NotificationRowItem
                    key={row.kind === "group" ? row.id : row.item.id}
                    row={row}
                    index={index}
                    expanded={row.kind === "group" ? expandedGroups.has(row.id) : false}
                    onToggleGroup={toggleGroup}
                    onActivate={handleRowActivate}
                  />
                ))}
              </Card>
            </div>
          ))}

          {paged.hasMore && (
            <div className="flex justify-center pt-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}
              >
                Show more
              </Button>
            </div>
          )}
        </div>
      )}
    </>
  );
}

function NotificationRowItem({
  row,
  index,
  expanded,
  onToggleGroup,
  onActivate,
}: {
  row: NotificationRow;
  index: number;
  expanded: boolean;
  onToggleGroup: (groupId: string) => void;
  onActivate: (row: NotificationRow) => void;
}) {
  if (row.kind === "single") {
    return (
      <SingleNotificationRow
        notification={row.item}
        index={index}
        onActivate={() => onActivate(row)}
      />
    );
  }

  const Icon = iconMap[row.items[0]?.type ?? "task"] ?? Bell;
  const preview = row.items
    .slice(0, 3)
    .map((item) => item.description)
    .join(" · ");

  return (
    <div className={cn(!row.unread ? "" : "bg-primary/[0.03]")}>
      <motion.button
        type="button"
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.02 }}
        onClick={() => {
          onActivate(row);
          onToggleGroup(row.id);
        }}
        className="flex w-full items-start gap-3 px-4 py-3.5 text-left transition hover:bg-muted/40"
      >
        <div className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-accent text-accent-foreground">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{row.title}</span>
            {row.unread && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
            <span className="ml-auto text-[11px] text-muted-foreground">{row.time}</span>
            <ChevronDown
              className={cn(
                "h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform",
                expanded && "rotate-180",
              )}
            />
          </div>
          {!expanded && (
            <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{preview}</p>
          )}
        </div>
      </motion.button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.ul
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-border/60 bg-muted/10 px-4 py-2"
          >
            {row.items.map((item) => (
              <li
                key={item.id}
                className="border-b border-border/40 py-2 text-xs text-muted-foreground last:border-b-0"
              >
                {item.description}
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}

function SingleNotificationRow({
  notification,
  index,
  onActivate,
}: {
  notification: AppNotification;
  index: number;
  onActivate: () => void;
}) {
  const Icon = iconMap[notification.type] ?? Bell;

  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.02 }}
      onClick={onActivate}
      className={cn(
        "flex w-full items-start gap-3 px-4 py-3.5 text-left transition hover:bg-muted/40",
        !notification.read && "bg-primary/[0.03]",
      )}
    >
      <div className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-accent text-accent-foreground">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{notification.title}</span>
          {!notification.read && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
          <span className="ml-auto text-[11px] text-muted-foreground">{notification.time}</span>
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">{notification.description}</p>
      </div>
    </motion.button>
  );
}

import { isTaskCompletedStatus, isTaskOverdue } from "@/lib/meetings/task-status";
import type { MeetingTaskRecord } from "@/lib/meetings/types";

export type OwnerInsightRow = {
  ownerKey: string;
  ownerLabel: string;
  assigned: number;
  completed: number;
  open: number;
  overdue: number;
  completionRate: number;
};

export type TeamInsightsSummary = {
  owners: OwnerInsightRow[];
  bestPerformer: OwnerInsightRow | null;
  mostOverdue: OwnerInsightRow | null;
  totalOwners: number;
  totalAssigned: number;
};

const UNASSIGNED_KEY = "__unassigned__";

function ownerKey(owner: string | null | undefined): string {
  const trimmed = owner?.trim();
  if (!trimmed) return UNASSIGNED_KEY;
  return trimmed.toLowerCase();
}

function ownerDisplayLabel(owner: string | null | undefined): string {
  const trimmed = owner?.trim();
  if (!trimmed) return "Unassigned";
  return trimmed;
}

function completionRate(completed: number, assigned: number): number {
  if (assigned <= 0) return 0;
  return Math.round((completed / assigned) * 100);
}

function compareOwners(a: OwnerInsightRow, b: OwnerInsightRow): number {
  if (b.completionRate !== a.completionRate) return b.completionRate - a.completionRate;
  if (b.completed !== a.completed) return b.completed - a.completed;
  return a.ownerLabel.localeCompare(b.ownerLabel);
}

function pickBestPerformer(owners: OwnerInsightRow[]): OwnerInsightRow | null {
  const eligible = owners.filter((row) => row.assigned > 0);
  if (eligible.length === 0) return null;
  return [...eligible].sort(compareOwners)[0] ?? null;
}

function pickMostOverdue(owners: OwnerInsightRow[]): OwnerInsightRow | null {
  const eligible = owners.filter((row) => row.overdue > 0);
  if (eligible.length === 0) return null;

  return [...eligible].sort((a, b) => {
    if (b.overdue !== a.overdue) return b.overdue - a.overdue;
    if (b.open !== a.open) return b.open - a.open;
    return a.ownerLabel.localeCompare(b.ownerLabel);
  })[0] ?? null;
}

export function computeTeamInsights(
  tasks: MeetingTaskRecord[],
  referenceDate: Date = new Date(),
): TeamInsightsSummary {
  const buckets = new Map<
    string,
    {
      ownerLabel: string;
      assigned: number;
      completed: number;
      open: number;
      overdue: number;
    }
  >();

  for (const task of tasks) {
    const key = ownerKey(task.owner);
    const label = ownerDisplayLabel(task.owner);
    const current = buckets.get(key) ?? {
      ownerLabel: label,
      assigned: 0,
      completed: 0,
      open: 0,
      overdue: 0,
    };

    current.assigned += 1;

    if (isTaskCompletedStatus(task.status)) {
      current.completed += 1;
    } else {
      current.open += 1;
      if (isTaskOverdue(task.deadline, referenceDate)) {
        current.overdue += 1;
      }
    }

    buckets.set(key, current);
  }

  const owners: OwnerInsightRow[] = [...buckets.entries()]
    .map(([key, row]) => ({
      ownerKey: key,
      ownerLabel: row.ownerLabel,
      assigned: row.assigned,
      completed: row.completed,
      open: row.open,
      overdue: row.overdue,
      completionRate: completionRate(row.completed, row.assigned),
    }))
    .sort(compareOwners);

  return {
    owners,
    bestPerformer: pickBestPerformer(owners),
    mostOverdue: pickMostOverdue(owners),
    totalOwners: owners.length,
    totalAssigned: tasks.length,
  };
}

import { describe, expect, it } from "vitest";
import { computeExecutionHealthBundle } from "./execution-health";
import {
  computeHealthScore,
  computeHealthScoreLabel,
  computeHealthScoreResult,
  computeOverduePercent,
  computeWeekProgress,
} from "./execution-health-score";
import { countAtRiskTasks, listAtRiskTasks } from "./at-risk-tasks";
import { buildExecutiveSummary } from "./execution-health-summary";
import type { MeetingTaskRecord } from "@/lib/meetings/types";

const referenceDate = new Date("2026-05-28T12:00:00.000Z");

const tasks: MeetingTaskRecord[] = [
  {
    id: "task-1",
    meeting_id: "meeting-a",
    task: "Ship dashboard",
    owner: "Nisarg",
    deadline: "2026-05-10",
    status: "pending",
    created_at: "2026-05-20T10:05:00.000Z",
    updated_at: "2026-05-20T10:05:00.000Z",
    started_at: null,
    completed_at: null,
  },
  {
    id: "task-2",
    meeting_id: "meeting-a",
    task: "Write release notes",
    owner: "Rahul",
    deadline: "2026-05-28",
    status: "completed",
    created_at: "2026-05-20T10:06:00.000Z",
    updated_at: "2026-05-27T10:06:00.000Z",
    started_at: "2026-05-25T10:06:00.000Z",
    completed_at: "2026-05-27T10:06:00.000Z",
  },
  {
    id: "task-3",
    meeting_id: "meeting-a",
    task: "Review launch checklist",
    owner: "Rahul",
    deadline: "2026-05-30",
    status: "in_progress",
    created_at: "2026-05-26T10:06:00.000Z",
    updated_at: "2026-05-26T10:06:00.000Z",
    started_at: "2026-05-26T10:06:00.000Z",
    completed_at: null,
  },
];

describe("computeHealthScoreResult", () => {
  it("computes weighted score with drivers", () => {
    const result = computeHealthScoreResult({
      completionRate: 82,
      onTimeRate: 91,
      overduePercent: 12,
      weekProgress: 40,
      openTasks: 14,
      assigned: 50,
      completedThisWeek: 5,
      atRiskCount: 2,
    });

    expect(result.score).toBe(82);
    expect(result.label).toBe("Healthy");
    expect(result.strengths.length).toBeGreaterThan(0);
    expect(result.risks.length).toBeGreaterThan(0);
  });

  it("labels Excellent at 90+", () => {
    expect(computeHealthScoreLabel(90)).toBe("Excellent");
    expect(computeHealthScoreLabel(89)).toBe("Healthy");
  });
});

describe("computeExecutionHealthBundle", () => {
  it("composes existing services without duplicate logic", () => {
    const bundle = computeExecutionHealthBundle(tasks, [], referenceDate);

    expect(bundle.overview.completionRate).toBeGreaterThan(0);
    expect(bundle.execution.totalOpen).toBeGreaterThan(0);
    expect(bundle.teamInsights.totalAssigned).toBe(tasks.length);
    expect(bundle.topPriorities.length).toBeGreaterThanOrEqual(0);
    expect(bundle.accountability.charts.weeklyCompletions).toHaveLength(8);
    expect(bundle.health.score).toBeGreaterThanOrEqual(0);
    expect(bundle.health.strengths.length).toBeLessThanOrEqual(2);
    expect(bundle.health.risks.length).toBeLessThanOrEqual(2);
    expect(bundle.executiveSummary).toContain("Execution Health is");
  });

  it("derives overdue percent from execution metrics", () => {
    const bundle = computeExecutionHealthBundle(tasks, [], referenceDate);
    const expected = computeOverduePercent(bundle.execution.overdue, tasks.length);
    expect(bundle.overview.overduePercent).toBe(expected);
  });

  it("derives week progress from execution metrics", () => {
    const bundle = computeExecutionHealthBundle(tasks, [], referenceDate);
    const expected = computeWeekProgress(bundle.execution.completedThisWeek, tasks.length);
    expect(computeHealthScore({
      completionRate: bundle.overview.completionRate,
      onTimeRate: bundle.overview.onTimeCompletionRate,
      overduePercent: bundle.overview.overduePercent,
      weekProgress: expected,
      openTasks: bundle.overview.openTasks,
      assigned: tasks.length,
      completedThisWeek: bundle.overview.completedThisWeek,
      atRiskCount: bundle.atRiskCount,
    })).toBe(bundle.health.score);
  });
});

describe("at-risk tasks", () => {
  it("lists open tasks due within three days", () => {
    const atRisk = listAtRiskTasks(tasks, referenceDate, 10);
    expect(atRisk.some((row) => row.task === "Review launch checklist")).toBe(true);
    expect(atRisk.every((row) => row.dueDate >= referenceDate)).toBe(true);
    expect(countAtRiskTasks(tasks, referenceDate)).toBe(atRisk.length);
  });
});

describe("buildExecutiveSummary", () => {
  it("builds deterministic prose", () => {
    const health = computeHealthScoreResult({
      completionRate: 82,
      onTimeRate: 91,
      overduePercent: 12,
      weekProgress: 40,
      openTasks: 14,
      assigned: 50,
      completedThisWeek: 5,
      atRiskCount: 2,
    });

    const summary = buildExecutiveSummary({
      health,
      completionRate: 82,
      overduePercent: 12,
      atRiskCount: 2,
      bestPerformer: { ownerLabel: "Rahul", metricLabel: "Completion rate", value: "100%" },
    });

    expect(summary).toContain("Execution Health is 82/100 (Healthy)");
    expect(summary).toContain("Completion rate is 82%");
    expect(summary).toContain("Rahul is currently the strongest performer");
    expect(summary).toContain("2 tasks are at risk this week");
  });
});

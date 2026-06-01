export type HealthScoreLabel = "Excellent" | "Healthy" | "Needs Attention" | "At Risk";

export type HealthScoreInputs = {
  completionRate: number;
  onTimeRate: number;
  overduePercent: number;
  weekProgress: number;
  openTasks: number;
  assigned: number;
  completedThisWeek: number;
  atRiskCount: number;
};

export type HealthScoreResult = {
  score: number;
  label: HealthScoreLabel;
  strengths: string[];
  risks: string[];
  summaryLine: string;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function computeOverduePercent(overdueOpen: number, assigned: number): number {
  if (assigned <= 0) return 0;
  return Math.round((overdueOpen / assigned) * 100);
}

export function computeWeekProgress(completedThisWeek: number, assigned: number): number {
  if (assigned <= 0) return 0;
  return Math.min(100, Math.round((completedThisWeek / assigned) * 100));
}

export function computeHealthScoreLabel(score: number): HealthScoreLabel {
  if (score >= 90) return "Excellent";
  if (score >= 75) return "Healthy";
  if (score >= 60) return "Needs Attention";
  return "At Risk";
}

export function computeHealthScore(inputs: HealthScoreInputs): number {
  const inverseOverdue = clamp(100 - inputs.overduePercent, 0, 100);
  const raw =
    0.4 * inputs.completionRate +
    0.3 * inputs.onTimeRate +
    0.2 * inverseOverdue +
    0.1 * inputs.weekProgress;
  return clamp(Math.round(raw), 0, 100);
}

type ScoredDriver = { text: string; weight: number };

function pickTopDrivers(drivers: ScoredDriver[], limit: number): string[] {
  return [...drivers]
    .sort((a, b) => b.weight - a.weight)
    .slice(0, limit)
    .map((driver) => driver.text);
}

function buildStrengths(inputs: HealthScoreInputs): ScoredDriver[] {
  const strengths: ScoredDriver[] = [];
  const openRatio = inputs.assigned > 0 ? inputs.openTasks / inputs.assigned : 0;

  if (inputs.completionRate >= 75) {
    strengths.push({ text: "Strong completion rate", weight: inputs.completionRate - 75 });
  }
  if (inputs.onTimeRate >= 75) {
    strengths.push({
      text: "Strong on-time completion rate",
      weight: inputs.onTimeRate - 75,
    });
  }
  if (inputs.overduePercent <= 15) {
    strengths.push({ text: "Low overdue workload", weight: 15 - inputs.overduePercent });
  }
  if (inputs.weekProgress >= 40 || inputs.completedThisWeek >= 2) {
    strengths.push({
      text: "Good weekly completion velocity",
      weight: Math.max(inputs.weekProgress - 40, inputs.completedThisWeek * 10),
    });
  }
  if (inputs.assigned > 0 && openRatio <= 0.4) {
    strengths.push({ text: "Manageable open workload", weight: (0.4 - openRatio) * 100 });
  }

  return strengths;
}

function buildRisks(inputs: HealthScoreInputs): ScoredDriver[] {
  const risks: ScoredDriver[] = [];
  const openRatio = inputs.assigned > 0 ? inputs.openTasks / inputs.assigned : 0;

  if (inputs.completionRate < 60) {
    risks.push({ text: "Completion rate below target", weight: 60 - inputs.completionRate });
  }
  if (inputs.onTimeRate < 60) {
    risks.push({
      text: "On-time completion needs improvement",
      weight: 60 - inputs.onTimeRate,
    });
  }
  if (inputs.overduePercent > 20) {
    risks.push({ text: "Elevated overdue workload", weight: inputs.overduePercent - 20 });
  }
  if (inputs.assigned > 0 && (openRatio > 0.5 || inputs.openTasks > 10)) {
    risks.push({ text: "Open task count remains elevated", weight: openRatio * 100 });
  }
  if (inputs.assigned > 0 && inputs.completedThisWeek === 0) {
    risks.push({ text: "No tasks completed this week", weight: 50 });
  }
  if (inputs.atRiskCount > 0) {
    const label =
      inputs.atRiskCount === 1
        ? "1 task is at risk this week"
        : `${inputs.atRiskCount} tasks are at risk this week`;
    risks.push({ text: label, weight: inputs.atRiskCount * 12 });
  }

  return risks;
}

function buildSummaryLine(label: HealthScoreLabel, strengths: string[], risks: string[]): string {
  if (label === "Excellent") {
    return "Excellent execution across completion, timing, and overdue workload.";
  }
  if (label === "Healthy") {
    if (strengths.length > 0) {
      return "Strong completion rate and low overdue workload.";
    }
    return "Overall execution is stable with manageable risk.";
  }
  if (label === "Needs Attention") {
    if (risks.length > 0) {
      return "Some execution metrics need attention to reduce delivery risk.";
    }
    return "Execution is acceptable but trending toward increased risk.";
  }
  return "Execution is at risk — overdue workload or completion gaps need immediate focus.";
}

export function computeHealthScoreResult(inputs: HealthScoreInputs): HealthScoreResult {
  const score = computeHealthScore(inputs);
  const label = computeHealthScoreLabel(score);
  const strengths = pickTopDrivers(buildStrengths(inputs), 2);
  const risks = pickTopDrivers(buildRisks(inputs), 2);

  return {
    score,
    label,
    strengths: strengths.length > 0 ? strengths : ["No standout strengths this period"],
    risks: risks.length > 0 ? risks : ["No major risks detected"],
    summaryLine: buildSummaryLine(label, strengths, risks),
  };
}

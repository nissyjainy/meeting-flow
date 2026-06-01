import { buildTaskReminderEmail, REMINDER_EMAIL_TEMPLATE_VERSION } from "./email-templates";
import { reminderLog } from "./reminder-debug";
import {
  REMINDER_SECTIONS,
  countClassifiedTasks,
  type ReminderSectionMeta,
} from "./reminder-labels";
import { normalizeClassifiedTasks } from "./task-reminder-classify";
import type { ClassifiedReminderTasks, MeetingReference } from "./task-reminder-types";

export { REMINDER_EMAIL_TEMPLATE_VERSION };

export type LiveReminderEmailParams = {
  recipientName?: string | null;
  meeting?: MeetingReference | null;
  classified: Partial<ClassifiedReminderTasks> | ClassifiedReminderTasks;
  subject: string;
  dispatchPath: string;
};

function activeReminderCategories(classified: ClassifiedReminderTasks): ReminderSectionMeta[] {
  return REMINDER_SECTIONS.filter((section) => classified[section.category].length > 0);
}

/** Single live entry point — all reminder dispatch paths must use this. */
export function buildLiveReminderEmail(params: LiveReminderEmailParams): {
  subject: string;
  html: string;
  text: string;
} {
  const normalized = normalizeClassifiedTasks(params.classified);
  const counts = countClassifiedTasks(normalized);
  const activeCategories = activeReminderCategories(normalized);

  reminderLog("reminder template generation start", {
    templateVersion: REMINDER_EMAIL_TEMPLATE_VERSION,
    templatePath: "email-templates.buildTaskReminderEmail",
    dispatchPath: params.dispatchPath,
    subject: params.subject,
    recipientName: params.recipientName ?? null,
    meetingId: params.meeting?.id ?? null,
    meetingTitle: params.meeting?.title ?? null,
    counts,
    activeCategories: activeCategories.map((section) => section.category),
    activeSectionLabels: activeCategories.map((section) => section.badgeLabel),
  });

  const template = buildTaskReminderEmail({
    recipientName: params.recipientName,
    meeting: params.meeting ?? null,
    classified: normalized,
    subject: params.subject,
  });

  reminderLog("reminder template generation complete", {
    templateVersion: REMINDER_EMAIL_TEMPLATE_VERSION,
    dispatchPath: params.dispatchPath,
    htmlLength: template.html.length,
    textLength: template.text.length,
    includesV2Marker: template.html.includes("reminder-template-v2"),
    includesSummary: template.html.includes("You have"),
    includesTaskCards: template.html.includes("reminder-task-card"),
    sectionCount: activeCategories.length,
    counts,
  });

  return template;
}

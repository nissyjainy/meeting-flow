import { format } from "date-fns";
import type { ClassifiedReminderTasks, MeetingReference, ReminderTaskItem } from "./task-reminder-types";
import { normalizeClassifiedTasks, parseDeadlineDate } from "./task-reminder-classify";
import {
  REMINDER_SECTIONS,
  buildReminderSummary,
  getReminderSectionMeta,
  type ReminderSectionMeta,
} from "./reminder-labels";

export const REMINDER_EMAIL_TEMPLATE_VERSION = "v2-labeled-cards";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function formatDeadlineDisplay(deadline: string | null): string {
  if (!deadline?.trim()) return "No deadline set";

  const parsed = parseDeadlineDate(deadline);
  if (parsed) {
    return format(parsed, "EEEE, MMM d, yyyy");
  }

  return deadline.trim();
}

function renderMetadataRow(label: string, value: string): string {
  return `
    <tr>
      <td style="padding:3px 12px 3px 0;vertical-align:top;font-size:12px;font-weight:600;color:#64748b;white-space:nowrap;width:72px;">${label}</td>
      <td style="padding:3px 0;vertical-align:top;font-size:13px;color:#334155;">${value}</td>
    </tr>`;
}

function renderTaskCard(item: ReminderTaskItem, section: ReminderSectionMeta): string {
  const owner = item.owner?.trim() ? escapeHtml(item.owner) : "Unassigned";
  const deadline = escapeHtml(formatDeadlineDisplay(item.deadline));
  const task = escapeHtml(item.task);
  const meetingTitle = escapeHtml(item.meeting.title);
  const meetingUrl = escapeHtml(item.meeting.url);

  return `
    <div class="reminder-task-card" style="margin:0 0 12px;padding:14px 16px;border:1px solid #e2e8f0;border-radius:10px;background:#f8fafc;">
      <p style="margin:0 0 10px;">
        <span style="display:inline-block;padding:3px 10px;border-radius:999px;font-size:10px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;background:${section.badgeBg};color:${section.badgeText};">${section.badgeLabel}</span>
      </p>
      <p style="margin:0 0 12px;font-size:15px;font-weight:600;line-height:1.45;color:#0f172a;">${task}</p>
      <table cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
        <tbody>
          ${renderMetadataRow("Owner", owner)}
          ${renderMetadataRow("Deadline", deadline)}
          ${renderMetadataRow("Meeting", `<a href="${meetingUrl}" style="color:#4f46e5;text-decoration:none;">${meetingTitle}</a>`)}
        </tbody>
      </table>
    </div>`;
}

function renderSection(section: ReminderSectionMeta, tasks: ReminderTaskItem[]): string {
  if (tasks.length === 0) return "";

  const cards = tasks.map((item) => renderTaskCard(item, section)).join("");

  return `
    <section style="margin:28px 0 0;">
      <div style="margin:0 0 12px;padding-bottom:8px;border-bottom:2px solid ${section.tone};">
        <h2 style="margin:0;font-size:16px;font-weight:700;color:${section.tone};">${section.title}</h2>
        <p style="margin:4px 0 0;font-size:13px;color:#64748b;">${section.description}</p>
      </div>
      ${cards}
    </section>`;
}

function renderClassifiedSections(classified: ClassifiedReminderTasks): string {
  const normalized = normalizeClassifiedTasks(classified);

  return REMINDER_SECTIONS.map((section) =>
    renderSection(section, normalized[section.category]),
  ).join("");
}

function renderTextTask(item: ReminderTaskItem, badgeLabel: string): string {
  return `[${badgeLabel}] ${item.task}
  Owner: ${item.owner ?? "Unassigned"}
  Deadline: ${formatDeadlineDisplay(item.deadline)}
  Meeting: ${item.meeting.title} (${item.meeting.url})`;
}

export function buildTaskReminderEmail(params: {
  recipientName?: string | null;
  meeting?: MeetingReference | null;
  classified: Partial<ClassifiedReminderTasks> | ClassifiedReminderTasks;
  subject: string;
}): { subject: string; html: string; text: string } {
  const classified = normalizeClassifiedTasks(params.classified);
  const greeting = params.recipientName?.trim()
    ? `Hi ${escapeHtml(params.recipientName.trim())},`
    : "Hi there,";

  const intro = params.meeting
    ? `Here are your action-item reminders for <strong>${escapeHtml(params.meeting.title)}</strong>.`
    : "Here is your action-item reminder digest.";

  const summary = buildReminderSummary(classified);
  const summaryHtml = summary
    ? `<p style="margin:0 0 20px;padding:12px 14px;border-radius:8px;background:#eff6ff;font-size:14px;color:#1e3a8a;">${escapeHtml(summary)}</p>`
    : "";

  const html = `
<!-- reminder-template-v2 ${REMINDER_EMAIL_TEMPLATE_VERSION} -->
<!DOCTYPE html>
<html>
  <body style="margin:0;padding:24px;background:#f8fafc;font-family:Inter,Segoe UI,sans-serif;color:#0f172a;">
    <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;padding:28px;">
      <p style="margin:0 0 8px;font-size:13px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;color:#64748b;">Northstar Meeting Flow</p>
      <h1 style="margin:0 0 16px;font-size:24px;font-weight:700;">Task reminders</h1>
      <p style="margin:0 0 8px;font-size:15px;color:#0f172a;">${greeting}</p>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.5;color:#334155;">${intro}</p>
      ${summaryHtml}
      ${renderClassifiedSections(classified)}
      ${
        params.meeting
          ? `<p style="margin:28px 0 0;font-size:14px;"><a href="${escapeHtml(params.meeting.url)}" style="color:#4f46e5;text-decoration:none;font-weight:600;">View meeting details →</a></p>`
          : ""
      }
    </div>
  </body>
</html>`;

  const textSections = REMINDER_SECTIONS.flatMap((section) => {
    const tasks = classified[section.category];
    if (tasks.length === 0) return [];

    return [
      `${section.title.toUpperCase()} (${section.badgeLabel})`,
      ...tasks.map((item) => renderTextTask(item, section.badgeLabel)),
    ].join("\n");
  });

  const text = [
    params.recipientName?.trim() ? `Hi ${params.recipientName.trim()},` : "Hi there,",
    "",
    params.meeting ? `Meeting: ${params.meeting.title}` : "Meeting task reminder digest",
    summary ?? "",
    textSections.join("\n\n"),
  ]
    .filter(Boolean)
    .join("\n");

  return { subject: params.subject, html, text };
}

export { formatDeadlineDisplay, getReminderSectionMeta };

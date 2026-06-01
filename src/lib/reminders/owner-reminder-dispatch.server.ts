import { buildLiveReminderEmail } from "./reminder-email-builder.server";
import { findTeamMemberForOwner } from "./owner-email-mapping.server";
import { reminderLog } from "./reminder-debug";
import { sendReminderEmail } from "./resend-client";
import {
  classifyReminderTask,
  createEmptyClassifiedTasks,
  hasRemindableTasks,
} from "./task-reminder-classify";
import { countClassifiedTasks } from "./reminder-labels";
import type {
  ClassifiedReminderTasks,
  MeetingReference,
  ReminderCategory,
  ReminderTaskItem,
  TeamMemberRecord,
} from "./task-reminder-types";

export type OwnerReminderRecipient = {
  email: string;
  name: string;
  classified: ClassifiedReminderTasks;
};

export type OwnerReminderDispatchResult = {
  emailsSent: number;
  emailsFailed: number;
  skipped: number;
  recipients: number;
  unmatchedTasks: number;
};

function createEmptyClassified(): ClassifiedReminderTasks {
  return createEmptyClassifiedTasks();
}

export function buildOwnerReminderRecipients(
  items: ReminderTaskItem[],
  teamMembersByMeetingId: Map<string, TeamMemberRecord[]>,
  upcomingWithinDays: number,
  categories?: ReminderCategory[],
): { recipients: OwnerReminderRecipient[]; unmatchedTasks: number } {
  const buckets = new Map<string, OwnerReminderRecipient>();
  let unmatchedTasks = 0;

  for (const item of items) {
    const teamMembers = teamMembersByMeetingId.get(item.meeting_id) ?? [];
    const member = findTeamMemberForOwner(item.owner, teamMembers);
    const email = member?.email?.trim();

    if (!email) {
      unmatchedTasks += 1;
      continue;
    }

    const category = classifyReminderTask(item, upcomingWithinDays);
    if (!category) continue;
    if (categories && !categories.includes(category)) continue;

    let bucket = buckets.get(email);
    if (!bucket) {
      bucket = {
        email,
        name: member.name.trim() || item.owner?.trim() || email,
        classified: createEmptyClassified(),
      };
      buckets.set(email, bucket);
    }

    bucket.classified[category].push(item);
  }

  const recipients = [...buckets.values()].filter((recipient) =>
    hasRemindableTasks(recipient.classified),
  );

  return { recipients, unmatchedTasks };
}

export async function dispatchOwnerReminderEmails(params: {
  recipients: OwnerReminderRecipient[];
  meeting?: MeetingReference | null;
  subject: string;
}): Promise<OwnerReminderDispatchResult> {
  let emailsSent = 0;
  let emailsFailed = 0;
  let skipped = 0;

  for (const recipient of params.recipients) {
    if (!hasRemindableTasks(recipient.classified)) {
      skipped += 1;
      continue;
    }

    const template = buildLiveReminderEmail({
      recipientName: recipient.name,
      meeting: params.meeting ?? null,
      classified: recipient.classified,
      subject: params.subject,
      dispatchPath: "owner-reminder-dispatch.dispatchOwnerReminderEmails",
    });

    reminderLog("owner reminder email dispatch", {
      to: recipient.email,
      recipientName: recipient.name,
      ...countClassifiedTasks(recipient.classified),
    });

    const outcome = await sendReminderEmail({
      to: recipient.email,
      subject: template.subject,
      html: template.html,
      text: template.text,
      meetingId: params.meeting?.id,
    });

    if (outcome.sent) emailsSent += 1;
    else if (!outcome.success) emailsFailed += 1;
    else skipped += 1;
  }

  return {
    emailsSent,
    emailsFailed,
    skipped,
    recipients: params.recipients.length,
    unmatchedTasks: 0,
  };
}

export function aggregateClassifiedTasks(
  recipients: OwnerReminderRecipient[],
): ClassifiedReminderTasks {
  const aggregated = createEmptyClassified();

  for (const recipient of recipients) {
    aggregated.pending.push(...recipient.classified.pending);
    aggregated.upcoming.push(...recipient.classified.upcoming);
    aggregated.sameDay.push(...recipient.classified.sameDay);
    aggregated.overdue.push(...recipient.classified.overdue);
  }

  return aggregated;
}

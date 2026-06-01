import type { SupabaseClient } from "@supabase/supabase-js";

import { getSupabaseServerClient } from "@/lib/supabase/server";

import { getSupabaseAdminClient } from "@/lib/supabase/admin";

import { buildLiveReminderEmail } from "./reminder-email-builder.server";

import {

  aggregateClassifiedTasks,

  buildOwnerReminderRecipients,

  dispatchOwnerReminderEmails,

} from "./owner-reminder-dispatch.server";

import { reminderError, reminderLog } from "./reminder-debug";

import { getReminderConfig, logReminderEnvStatus } from "./reminder-env";

import { sendReminderEmail } from "./resend-client";

import {

  attachMeetingToTasks,

  fetchAllReminderTaskItems,

  fetchMeetingTasks,

  fetchTeamMembersForMeeting,

  fetchTeamMembersForMeetings,

} from "./task-reminder-data.server";

import {

  classifyReminderTasks,

  filterClassifiedByCategories,

  hasRemindableTasks,

} from "./task-reminder-classify";

import { AUTOMATIC_REMINDER_CATEGORIES, countClassifiedTasks } from "./reminder-labels";

import type { ClassifiedReminderTasks, ReminderCategory } from "./task-reminder-types";



export type TaskReminderPipelineOutcome = {

  success: boolean;

  sent: boolean;

  error?: string;

  skippedReason?: string;

  emailsSent?: number;

  emailsFailed?: number;

  recipients?: number;

  unmatchedTasks?: number;

  counts?: {

    pending: number;

    upcoming: number;

    sameDay: number;

    overdue: number;

  };

};



function reminderCategoriesForReason(reason: string): ReminderCategory[] | undefined {

  if (reason === "manual-test") return undefined;

  return AUTOMATIC_REMINDER_CATEGORIES;

}



async function resolveRecipientEmail(

  supabase: SupabaseClient,

  explicitEmail?: string | null,

): Promise<string | null> {

  const config = getReminderConfig();



  if (explicitEmail?.trim()) {

    reminderLog("recipient resolved — explicit", { email: explicitEmail.trim() });

    return explicitEmail.trim();

  }



  if (config.fallbackTo) {

    reminderLog("recipient resolved — REMINDER_EMAIL_TO", { email: config.fallbackTo });

    return config.fallbackTo;

  }



  const {

    data: { user },

  } = await supabase.auth.getUser();



  if (user?.email?.trim()) {

    reminderLog("recipient resolved — authenticated user", { email: user.email.trim() });

    return user.email.trim();

  }



  reminderLog("recipient not resolved — no email available");

  return null;

}



async function sendClassifiedReminderEmail(params: {

  to: string;

  classified: ClassifiedReminderTasks;

  meeting?: ClassifiedReminderTasks["pending"][0]["meeting"] | null;

  subject: string;

  recipientName?: string | null;

}): Promise<TaskReminderPipelineOutcome> {

  if (!hasRemindableTasks(params.classified)) {

    reminderLog("reminder email skipped — no remindable tasks", countClassifiedTasks(params.classified));

    return {

      success: true,

      sent: false,

      skippedReason: "No overdue, due-today, upcoming, or pending tasks to remind.",

      counts: {

        pending: 0,

        upcoming: 0,

        sameDay: 0,

        overdue: 0,

      },

    };

  }



  const template = buildLiveReminderEmail({

    recipientName: params.recipientName,

    meeting: params.meeting ?? null,

    classified: params.classified,

    subject: params.subject,

    dispatchPath: "task-reminder-pipeline.sendClassifiedReminderEmail",

  });



  reminderLog("email payload generated (classified)", {

    subject: template.subject,

    ...countClassifiedTasks(params.classified),

  });



  const outcome = await sendReminderEmail({

    to: params.to,

    subject: template.subject,

    html: template.html,

    text: template.text,

    meetingId: params.meeting?.id,

  });



  return {

    success: outcome.success,

    sent: outcome.sent,

    error: outcome.error,

    skippedReason: outcome.skippedReason,

    emailsSent: outcome.sent ? 1 : 0,

    emailsFailed: outcome.success ? 0 : outcome.sent ? 0 : 1,

    recipients: 1,

    counts: countClassifiedTasks(params.classified),

  };

}



function outcomeFromOwnerDispatch(

  dispatch: Awaited<ReturnType<typeof dispatchOwnerReminderEmails>>,

  classified: ClassifiedReminderTasks,

  skippedReason?: string,

): TaskReminderPipelineOutcome {

  const sent = dispatch.emailsSent > 0;



  return {

    success: dispatch.emailsFailed === 0,

    sent,

    skippedReason: sent ? undefined : skippedReason,

    emailsSent: dispatch.emailsSent,

    emailsFailed: dispatch.emailsFailed,

    recipients: dispatch.recipients,

    unmatchedTasks: dispatch.unmatchedTasks,

    counts: countClassifiedTasks(classified),

  };

}



export async function runMeetingTaskReminderEmails(

  meetingId: string,

  reason = "manual",

): Promise<TaskReminderPipelineOutcome> {

  reminderLog("reminder pipeline started", { meetingId, reason });

  logReminderEnvStatus("runMeetingTaskReminderEmails");



  const config = getReminderConfig();

  const supabase = getSupabaseServerClient();

  const categories = reminderCategoriesForReason(reason);



  try {

    const [{ meeting, tasks }, teamMembers] = await Promise.all([

      fetchMeetingTasks(supabase, meetingId),

      fetchTeamMembersForMeeting(supabase, meetingId),

    ]);



    reminderLog("tasks fetched", { meetingId, taskCount: tasks.length, meetingTitle: meeting?.title });



    if (!meeting) {

      throw new Error(`Meeting not found: ${meetingId}`);

    }



    const items = attachMeetingToTasks(tasks, meeting);

    const teamMembersByMeetingId = new Map([[meetingId, teamMembers]]);

    const { recipients, unmatchedTasks } = buildOwnerReminderRecipients(

      items,

      teamMembersByMeetingId,

      config.upcomingDays,

      categories,

    );



    reminderLog("meeting reminder owner recipients built", {

      meetingId,

      recipientCount: recipients.length,

      unmatchedTasks,

      categories: categories ?? "all",

    });



    if (recipients.length > 0) {

      const dispatch = await dispatchOwnerReminderEmails({

        recipients,

        meeting,

        subject: `Action items: ${meeting.title}`,

      });



      dispatch.unmatchedTasks = unmatchedTasks;



      const outcome = outcomeFromOwnerDispatch(

        dispatch,

        aggregateClassifiedTasks(recipients),

        dispatch.emailsSent === 0

          ? "No owner reminder emails were sent (check Resend config or task deadlines)."

          : undefined,

      );



      reminderLog("meeting reminder pipeline finished (owner dispatch)", {

        meetingId,

        ...outcome,

      });



      return outcome;

    }



    reminderLog("meeting reminder falling back — no matched owner emails", {

      meetingId,

      unmatchedTasks,

      teamMemberCount: teamMembers.length,

    });



    const classified = classifyReminderTasks(items, config.upcomingDays);

    const filtered = filterClassifiedByCategories(classified, categories);



    if (!hasRemindableTasks(filtered)) {

      return {

        success: true,

        sent: false,

        skippedReason: categories

          ? "No overdue, due-today, or upcoming tasks with matched team member emails."

          : "No overdue, due-today, upcoming, or pending tasks to remind.",

        unmatchedTasks,

        counts: countClassifiedTasks(filtered),

      };

    }



    const recipientEmail = await resolveRecipientEmail(supabase);

    if (!recipientEmail) {

      return {

        success: true,

        sent: false,

        skippedReason:

          "No matched owner emails and no authenticated user / REMINDER_EMAIL_TO fallback.",

        unmatchedTasks,

      };

    }



    const {

      data: { user },

    } = await supabase.auth.getUser();



    const outcome = await sendClassifiedReminderEmail({

      to: recipientEmail,

      classified: filtered,

      meeting,

      subject: `Action items: ${meeting.title}`,

      recipientName: user?.user_metadata?.full_name ?? user?.email ?? null,

    });



    reminderLog("meeting reminder pipeline finished (fallback recipient)", {

      meetingId,

      sent: outcome.sent,

      success: outcome.success,

      skippedReason: outcome.skippedReason ?? null,

      error: outcome.error ?? null,

      counts: outcome.counts,

      unmatchedTasks,

    });



    return { ...outcome, unmatchedTasks };

  } catch (error) {

    const message = error instanceof Error ? error.message : "Meeting reminder pipeline failed";

    reminderError("meeting reminder pipeline failed (non-fatal)", error, { meetingId });

    return { success: false, sent: false, error: message };

  }

}



export async function runScheduledTaskReminderEmails(): Promise<{

  success: boolean;

  usersProcessed: number;

  emailsSent: number;

  emailsFailed: number;

  skipped: number;

  recipients?: number;

  unmatchedTasks?: number;

}> {

  reminderLog("scheduler triggered — scheduled reminder pipeline started");

  logReminderEnvStatus("runScheduledTaskReminderEmails");



  const admin = getSupabaseAdminClient();

  if (!admin) {

    reminderLog("scheduled reminder skipped — SUPABASE_SERVICE_ROLE_KEY not set");

    return {

      success: true,

      usersProcessed: 0,

      emailsSent: 0,

      emailsFailed: 0,

      skipped: 1,

    };

  }



  const config = getReminderConfig();

  const categories = AUTOMATIC_REMINDER_CATEGORIES;



  try {

    const items = await fetchAllReminderTaskItems(admin);

    const meetingIds = [...new Set(items.map((item) => item.meeting_id))];

    const teamMembersByMeetingId = await fetchTeamMembersForMeetings(admin, meetingIds);



    const { recipients, unmatchedTasks } = buildOwnerReminderRecipients(

      items,

      teamMembersByMeetingId,

      config.upcomingDays,

      categories,

    );



    reminderLog("scheduled reminder owner recipients built", {

      taskCount: items.length,

      recipientCount: recipients.length,

      unmatchedTasks,

    });



    if (recipients.length === 0) {

      reminderLog("scheduled reminder skipped — no owner recipients", { unmatchedTasks });

      return {

        success: true,

        usersProcessed: 0,

        emailsSent: 0,

        emailsFailed: 0,

        skipped: 1,

        recipients: 0,

        unmatchedTasks,

      };

    }



    const dispatch = await dispatchOwnerReminderEmails({

      recipients,

      meeting: null,

      subject: "Your meeting task reminders",

    });



    reminderLog("scheduled reminder pipeline finished", {

      recipients: dispatch.recipients,

      emailsSent: dispatch.emailsSent,

      emailsFailed: dispatch.emailsFailed,

      skipped: dispatch.skipped,

      unmatchedTasks,

    });



    return {

      success: dispatch.emailsFailed === 0,

      usersProcessed: dispatch.recipients,

      emailsSent: dispatch.emailsSent,

      emailsFailed: dispatch.emailsFailed,

      skipped: dispatch.skipped,

      recipients: dispatch.recipients,

      unmatchedTasks,

    };

  } catch (error) {

    reminderError("scheduled reminder pipeline failed", error);

    return {

      success: false,

      usersProcessed: 0,

      emailsSent: 0,

      emailsFailed: 1,

      skipped: 0,

    };

  }

}



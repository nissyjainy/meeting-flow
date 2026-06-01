import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { reminderLog } from "./reminder-debug";

export async function recordReminderSend(params: {
  meetingId?: string | null;
  recipient: string;
  subject?: string;
}): Promise<void> {
  const admin = getSupabaseAdminClient();
  const supabase = admin ?? getSupabaseServerClient();

  const { error } = await supabase.from("reminder_sends").insert({
    meeting_id: params.meetingId ?? null,
    recipient: params.recipient,
    subject: params.subject ?? null,
  });

  if (error) {
    reminderLog("reminder send record skipped", {
      recipient: params.recipient,
      meetingId: params.meetingId ?? null,
      error: error.message,
    });
    return;
  }

  reminderLog("reminder send recorded", {
    recipient: params.recipient,
    meetingId: params.meetingId ?? null,
  });
}

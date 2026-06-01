import { useState } from "react";
import { Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { sendMeetingRemindersFn } from "@/lib/reminders/send-meeting-reminders";

type MeetingReminderTestButtonProps = {
  meetingId: string;
  onStatusChange?: (status: string | null) => void;
};

export function MeetingReminderTestButton({
  meetingId,
  onStatusChange,
}: MeetingReminderTestButtonProps) {
  const [loading, setLoading] = useState(false);

  if (!import.meta.env.DEV) {
    return null;
  }

  function updateStatus(message: string | null) {
    onStatusChange?.(message);
  }

  async function handleTestReminders() {
    setLoading(true);
    updateStatus(null);
    try {
      const outcome = await sendMeetingRemindersFn({ data: { meetingId } });
      if (outcome.sent) {
        const count = outcome.emailsSent ?? 1;
        updateStatus(
          count > 1
            ? `${count} owner reminder emails sent — check inbox/spam.`
            : "Email sent — check inbox/spam.",
        );
      } else if (outcome.error) {
        updateStatus(`Failed: ${outcome.error}`);
      } else {
        updateStatus(outcome.skippedReason ?? "Skipped (see server terminal logs).");
      }
    } catch (error) {
      updateStatus(error instanceof Error ? error.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={loading}
      onClick={handleTestReminders}
    >
      <Mail className="mr-1.5 h-3.5 w-3.5" />
      {loading ? "Sending…" : "Test reminders"}
    </Button>
  );
}

/** Dev-only status line shown below the action row (avoids breaking header flex layout). */
export function MeetingReminderTestStatus({ message }: { message: string | null }) {
  if (!import.meta.env.DEV || !message) {
    return null;
  }

  return (
    <p className="mt-4 text-xs leading-normal text-muted-foreground" title={message}>
      {message}
    </p>
  );
}

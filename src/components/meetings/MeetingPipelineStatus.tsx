import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { MeetingPipelineDisplay } from "@/lib/meetings/meeting-display";

const LABELS: Record<MeetingPipelineDisplay, string> = {
  processing: "Processing",
  completed: "Completed",
  failed: "Failed",
};

type MeetingPipelineStatusProps = {
  status: MeetingPipelineDisplay;
  className?: string;
};

export function MeetingPipelineStatus({ status, className }: MeetingPipelineStatusProps) {
  if (status === "processing") {
    return (
      <Badge variant="secondary" className={className}>
        <Loader2 className="h-3 w-3 animate-spin" />
        {LABELS.processing}
      </Badge>
    );
  }

  if (status === "failed") {
    return (
      <Badge variant="destructive" className={className}>
        <XCircle className="h-3 w-3" />
        {LABELS.failed}
      </Badge>
    );
  }

  return (
    <Badge className={`bg-success/15 text-success hover:bg-success/15 ${className ?? ""}`}>
      <CheckCircle2 className="h-3 w-3" />
      {LABELS.completed}
    </Badge>
  );
}

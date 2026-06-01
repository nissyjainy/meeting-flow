import { useId, useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

/** Summaries longer than this show a Show more / Show less control (starts expanded). */
const LONG_SUMMARY_CHAR_THRESHOLD = 280;
const LONG_SUMMARY_LINE_THRESHOLD = 4;
const SCROLLABLE_SUMMARY_CHAR_THRESHOLD = 1200;

type MeetingSummaryDisplayProps = {
  summary: string;
  className?: string;
};

function isLongSummary(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length > LONG_SUMMARY_CHAR_THRESHOLD) return true;
  return trimmed.split(/\r?\n/).length > LONG_SUMMARY_LINE_THRESHOLD;
}

export function MeetingSummaryDisplay({ summary, className }: MeetingSummaryDisplayProps) {
  const contentId = useId();
  const text = summary.trim();
  const long = useMemo(() => isLongSummary(text), [text]);
  const [sectionOpen, setSectionOpen] = useState(true);
  const [expanded, setExpanded] = useState(true);

  const needsScrollWhenExpanded = expanded && text.length > SCROLLABLE_SUMMARY_CHAR_THRESHOLD;

  return (
    <Collapsible open={sectionOpen} onOpenChange={setSectionOpen} className={className}>
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center justify-between gap-2 rounded-md py-1 text-left text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          aria-expanded={sectionOpen}
        >
          <span>{sectionOpen ? "Summary visible" : "Summary hidden"}</span>
          <ChevronDown
            className={cn("h-3.5 w-3.5 shrink-0 transition-transform", sectionOpen && "rotate-180")}
          />
        </button>
      </CollapsibleTrigger>

      <CollapsibleContent className="mt-2 overflow-visible data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
        <div
          id={contentId}
          className={cn(
            "rounded-lg border border-border bg-muted/20 px-3 py-3 sm:px-4",
            needsScrollWhenExpanded && "max-h-[min(32rem,60vh)] overflow-y-auto overscroll-contain",
          )}
        >
          <p
            className={cn(
              "whitespace-pre-wrap break-words text-sm leading-6 text-foreground",
              "[overflow-wrap:anywhere]",
              !expanded && long && "line-clamp-4",
            )}
          >
            {text}
          </p>
        </div>

        {long && (
          <Button
            type="button"
            variant="link"
            size="sm"
            className="mt-2 h-auto px-0 text-xs"
            onClick={() => setExpanded((prev) => !prev)}
            aria-expanded={expanded}
            aria-controls={contentId}
          >
            {expanded ? "Show less" : "Show more"}
          </Button>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}

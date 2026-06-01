import { Link } from "@tanstack/react-router";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type MeetingLoadErrorViewProps = {
  title: string;
  message?: string;
  backLabel?: string;
  onRetry?: () => void;
};

export function MeetingLoadErrorView({
  title,
  message = "Something went wrong while loading this page. Try again in a moment.",
  backLabel = "Back to meetings",
  onRetry,
}: MeetingLoadErrorViewProps) {
  return (
    <article className="mx-auto w-full max-w-4xl px-4 py-8">
      <Card className="flex flex-col items-center gap-3 p-10 text-center shadow-card">
        <AlertCircle className="h-8 w-8 text-destructive" aria-hidden />
        <h1 className="text-lg font-semibold">{title}</h1>
        <p className="max-w-md text-sm text-muted-foreground">{message}</p>
        <div className="mt-2 flex flex-wrap justify-center gap-2">
          {onRetry ? (
            <Button type="button" variant="outline" size="sm" onClick={onRetry}>
              Try again
            </Button>
          ) : null}
          <Button type="button" variant="ghost" size="sm" asChild>
            <Link to="/meetings" search={{ upload: false }}>{backLabel}</Link>
          </Button>
        </div>
      </Card>
    </article>
  );
}

import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type EmptyStateCardProps = {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
};

export function EmptyStateCard({ title, description, action, className }: EmptyStateCardProps) {
  return (
    <Card
      className={cn(
        "flex flex-col items-center justify-center px-4 py-12 text-center shadow-card sm:py-16",
        className,
      )}
    >
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description ? (
        <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">{description}</p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </Card>
  );
}

import { motion } from "framer-motion";
import { ArrowDownRight, ArrowUpRight, type LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface Props {
  label: string;
  value: string | number;
  delta?: number;
  icon: LucideIcon;
  suffix?: string;
  index?: number;
}

export function StatCard({ label, value, delta, icon: Icon, suffix, index = 0 }: Props) {
  const positive = delta == null ? true : delta >= 0;

  return (
    <motion.div
      className="h-full min-w-0"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
    >
      <Card className="flex h-full min-h-[6.75rem] min-w-0 flex-col overflow-hidden p-2.5 shadow-card transition-shadow hover:shadow-elegant sm:min-h-[7.25rem] sm:p-3">
        <div className="flex items-start justify-between gap-1">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-accent text-accent-foreground">
            <Icon className="h-4 w-4" />
          </div>
          {delta != null && (
            <div
              className={cn(
                "inline-flex shrink-0 items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-medium sm:text-xs",
                positive ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive",
              )}
            >
              {positive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
              {Math.abs(delta)}%
            </div>
          )}
        </div>
        <div className="mt-auto min-w-0 pt-2">
          <div className="text-xl font-semibold tabular-nums leading-none tracking-tight sm:text-2xl">
            {value}
            {suffix && (
              <span className="ml-0.5 text-sm font-normal text-muted-foreground">{suffix}</span>
            )}
          </div>
          <p
            className="mt-1 line-clamp-2 text-[10px] font-medium leading-snug text-muted-foreground sm:text-[11px]"
            title={label}
          >
            {label}
          </p>
        </div>
      </Card>
    </motion.div>
  );
}

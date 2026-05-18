import { motion } from "framer-motion";
import { ArrowDownRight, ArrowUpRight, type LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface Props {
  label: string;
  value: string | number;
  delta: number;
  icon: LucideIcon;
  suffix?: string;
  index?: number;
}

export function StatCard({ label, value, delta, icon: Icon, suffix, index = 0 }: Props) {
  const positive = delta >= 0;
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
    >
      <Card className="p-5 shadow-card hover:shadow-elegant transition-shadow">
        <div className="flex items-start justify-between">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-accent text-accent-foreground">
            <Icon className="h-4 w-4" />
          </div>
          <div
            className={cn(
              "inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-medium",
              positive ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
            )}
          >
            {positive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
            {Math.abs(delta)}%
          </div>
        </div>
        <div className="mt-4 text-2xl font-semibold tracking-tight">
          {value}
          {suffix && <span className="ml-0.5 text-base font-normal text-muted-foreground">{suffix}</span>}
        </div>
        <div className="mt-1 text-sm text-muted-foreground">{label}</div>
      </Card>
    </motion.div>
  );
}
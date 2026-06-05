import { Link, useRouterState } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  Video,
  ListChecks,
  Users,
  Settings,
  Bell,
  Sparkles,
  Plus,
  Loader2,
  BarChart3,
  LineChart,
  Activity,
  MessageSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useMeetingUploadTrigger } from "@/providers/meeting-upload-provider";
import { PRODUCT_NAME } from "@/lib/branding";

const nav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/assistant", label: "Assistant", icon: MessageSquare },
  { to: "/meetings", label: "Meetings", icon: Video },
  { to: "/tasks", label: "Tasks", icon: ListChecks },
  { to: "/team-insights", label: "Team Insights", icon: BarChart3 },
  { to: "/execution-health", label: "Execution Health", icon: Activity },
  { to: "/analytics", label: "Analytics", icon: LineChart },
  { to: "/notifications", label: "Notifications", icon: Bell },
  { to: "/team", label: "Team", icon: Users },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

export function AppSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { openUploadDialog, isProcessing } = useMeetingUploadTrigger();

  return (
    <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
      <div className="flex h-16 items-center gap-2 px-5 border-b border-sidebar-border">
        <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-primary shadow-elegant">
          <Sparkles className="h-4 w-4 text-primary-foreground" />
        </div>
        <div className="leading-tight">
          <div className="text-sm font-semibold text-sidebar-foreground">{PRODUCT_NAME}</div>
          <div className="text-[11px] text-muted-foreground">AI meeting workflow</div>
        </div>
      </div>

      <div className="p-3">
        <Button
          type="button"
          size="sm"
          className="w-full justify-start gap-2 bg-gradient-primary text-primary-foreground hover:opacity-90"
          onClick={() => openUploadDialog()}
          disabled={isProcessing}
        >
          {isProcessing ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Plus className="h-4 w-4" aria-hidden />
          )}
          {isProcessing ? "Processing…" : "New meeting"}
        </Button>
      </div>

      <nav className="flex-1 space-y-1 px-3">
        {nav.map((item) => {
          const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/60"
              )}
            >
              {active && (
                <motion.div
                  layoutId="sidebar-active"
                  className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r bg-sidebar-primary"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
              <item.icon className="h-4 w-4" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
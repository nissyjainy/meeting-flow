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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const nav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/meetings", label: "Meetings", icon: Video },
  { to: "/tasks", label: "Tasks", icon: ListChecks },
  { to: "/notifications", label: "Notifications", icon: Bell },
  { to: "/team", label: "Team", icon: Users },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

export function AppSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
      <div className="flex h-16 items-center gap-2 px-5 border-b border-sidebar-border">
        <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-primary shadow-elegant">
          <Sparkles className="h-4 w-4 text-primary-foreground" />
        </div>
        <div className="leading-tight">
          <div className="text-sm font-semibold text-sidebar-foreground">Northstar</div>
          <div className="text-[11px] text-muted-foreground">Meeting Intelligence</div>
        </div>
      </div>

      <div className="p-3">
        <Button size="sm" className="w-full justify-start gap-2 bg-gradient-primary text-primary-foreground hover:opacity-90">
          <Plus className="h-4 w-4" /> New meeting
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

      <div className="m-3 rounded-xl border border-sidebar-border bg-gradient-subtle p-4">
        <div className="flex items-center gap-2 text-xs font-medium text-sidebar-foreground">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          Upgrade to Enterprise
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Unlock SSO, audit logs and unlimited transcription.
        </p>
        <Button size="sm" variant="outline" className="mt-3 w-full">
          See plans
        </Button>
      </div>
    </aside>
  );
}
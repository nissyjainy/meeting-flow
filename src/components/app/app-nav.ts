import {
  Activity,
  BarChart3,
  Bell,
  LayoutDashboard,
  LineChart,
  ListChecks,
  MessageSquare,
  Puzzle,
  Settings,
  Users,
  Video,
  type LucideIcon,
} from "lucide-react";

export type AppNavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
};

export const appNav: AppNavItem[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/assistant", label: "Assistant", icon: MessageSquare },
  { to: "/meetings", label: "Meetings", icon: Video },
  { to: "/install", label: "Install Extension", icon: Puzzle },
  { to: "/tasks", label: "Tasks", icon: ListChecks },
  { to: "/team-insights", label: "Team Insights", icon: BarChart3 },
  { to: "/execution-health", label: "Execution Health", icon: Activity },
  { to: "/analytics", label: "Analytics", icon: LineChart },
  { to: "/notifications", label: "Notifications", icon: Bell },
  { to: "/team", label: "Team", icon: Users },
  { to: "/settings", label: "Settings", icon: Settings },
];

export function isAppNavActive(pathname: string, to: string): boolean {
  return to === "/" ? pathname === "/" : pathname.startsWith(to);
}

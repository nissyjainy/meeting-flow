import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  Video, Clock, ListChecks, TrendingUp, Sparkles, ArrowRight, CheckCircle2, Circle,
} from "lucide-react";
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { StatCard } from "@/components/dashboard/StatCard";
import { analytics, meetings, tasks } from "@/lib/mock-data";

export const Route = createFileRoute("/_app/")({
  head: () => ({
    meta: [
      { title: "Dashboard — Northstar Meeting Intelligence" },
      { name: "description", content: "Your AI-powered meeting workspace: summaries, action items, and team progress at a glance." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const recent = meetings.filter((m) => m.status === "ready").slice(0, 4);
  const upcoming = meetings.find((m) => m.status === "scheduled");
  const myTasks = tasks.filter((t) => t.status !== "done").slice(0, 5);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 md:px-8">
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-wrap items-end justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Good morning, Daniel</h1>
          <p className="text-sm text-muted-foreground">
            You have <span className="font-medium text-foreground">3 meetings</span> today and{" "}
            <span className="font-medium text-foreground">7 open action items</span>.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">Import recording</Button>
          <Button size="sm" className="bg-gradient-primary text-primary-foreground hover:opacity-90">
            <Sparkles className="mr-1.5 h-3.5 w-3.5" /> Ask Copilot
          </Button>
        </div>
      </motion.div>

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Meetings this week" value={analytics.meetingsThisWeek} delta={analytics.meetingsDelta} icon={Video} index={0} />
        <StatCard label="Hours saved" value={analytics.hoursSaved} suffix="h" delta={analytics.hoursDelta} icon={Clock} index={1} />
        <StatCard label="Tasks created" value={analytics.tasksCreated} delta={analytics.tasksDelta} icon={ListChecks} index={2} />
        <StatCard label="Completion rate" value={analytics.completionRate} suffix="%" delta={analytics.completionDelta} icon={TrendingUp} index={3} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2 p-5 shadow-card">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold">Activity this week</div>
              <div className="text-xs text-muted-foreground">Meetings transcribed and tasks captured</div>
            </div>
            <Badge variant="secondary">Live</Badge>
          </div>
          <div className="mt-4 h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={analytics.weekly} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="oklch(0.56 0.21 270)" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="oklch(0.56 0.21 270)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="g2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="oklch(0.72 0.18 295)" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="oklch(0.72 0.18 295)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="day" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{
                    background: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Area type="monotone" dataKey="tasks" stroke="oklch(0.72 0.18 295)" strokeWidth={2} fill="url(#g2)" />
                <Area type="monotone" dataKey="meetings" stroke="oklch(0.56 0.21 270)" strokeWidth={2} fill="url(#g1)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5 shadow-card">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold">Up next</div>
            <Badge variant="outline">Today</Badge>
          </div>
          {upcoming && (
            <div className="mt-4 rounded-xl border border-border bg-gradient-subtle p-4">
              <div className="text-xs text-muted-foreground">{upcoming.date}</div>
              <div className="mt-1 text-sm font-medium">{upcoming.title}</div>
              <div className="mt-3 flex -space-x-2">
                {upcoming.participants.map((p) => (
                  <Avatar key={p} className="h-7 w-7 border-2 border-background">
                    <AvatarFallback className="bg-muted text-[10px]">{p}</AvatarFallback>
                  </Avatar>
                ))}
              </div>
              <Button size="sm" className="mt-4 w-full">Join with Copilot</Button>
            </div>
          )}
          <div className="mt-5">
            <div className="mb-2 text-xs font-medium text-muted-foreground">My open tasks</div>
            <ul className="space-y-2.5">
              {myTasks.map((t) => (
                <li key={t.id} className="flex items-start gap-2.5">
                  {t.status === "done" ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 text-success" />
                  ) : (
                    <Circle className="mt-0.5 h-4 w-4 text-muted-foreground" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm">{t.title}</div>
                    <div className="mt-1">
                      <Progress value={t.progress} className="h-1" />
                    </div>
                  </div>
                  <span className="text-[11px] text-muted-foreground">{t.dueDate}</span>
                </li>
              ))}
            </ul>
          </div>
        </Card>
      </div>

      <div className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Recent meetings</h2>
          <Link to="/meetings" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
            View all <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {recent.map((m, i) => (
            <motion.div key={m.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
              <Link to="/meetings/$id" params={{ id: m.id }}>
                <Card className="p-4 shadow-card transition-all hover:shadow-elegant hover:-translate-y-0.5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{m.title}</div>
                      <div className="mt-0.5 text-xs text-muted-foreground">{m.date} · {m.duration}</div>
                    </div>
                    <Badge variant="secondary" className="shrink-0">{m.recordingType}</Badge>
                  </div>
                  <p className="mt-3 line-clamp-2 text-xs text-muted-foreground">{m.summary}</p>
                  <div className="mt-3 flex items-center justify-between">
                    <div className="flex -space-x-2">
                      {m.participants.map((p) => (
                        <Avatar key={p} className="h-6 w-6 border-2 border-card">
                          <AvatarFallback className="bg-muted text-[10px]">{p}</AvatarFallback>
                        </Avatar>
                      ))}
                    </div>
                    <span className="text-[11px] text-muted-foreground">{m.actionItems} action items</span>
                  </div>
                </Card>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
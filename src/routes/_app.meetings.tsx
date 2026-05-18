import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { motion } from "framer-motion";
import { Upload, Filter, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { meetings } from "@/lib/mock-data";

export const Route = createFileRoute("/_app/meetings")({
  head: () => ({
    meta: [
      { title: "Meetings — Northstar" },
      { name: "description", content: "Every meeting, transcribed and searchable, with AI summaries and action items." },
    ],
  }),
  component: MeetingsPage,
});

function MeetingsPage() {
  const [filter, setFilter] = useState<"all" | "ready" | "processing" | "scheduled">("all");
  const [q, setQ] = useState("");
  const filtered = meetings.filter(
    (m) => (filter === "all" || m.status === filter) && m.title.toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 md:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Meetings</h1>
          <p className="text-sm text-muted-foreground">All recorded, transcribed and AI-summarized conversations.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm"><Filter className="mr-1.5 h-3.5 w-3.5" /> Filters</Button>
          <Button size="sm" className="bg-gradient-primary text-primary-foreground hover:opacity-90">
            <Upload className="mr-1.5 h-3.5 w-3.5" /> Upload recording
          </Button>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="ready">Ready</TabsTrigger>
            <TabsTrigger value="processing">Processing</TabsTrigger>
            <TabsTrigger value="scheduled">Scheduled</TabsTrigger>
          </TabsList>
        </Tabs>
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by title…"
          className="max-w-xs"
        />
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((m, i) => (
          <motion.div key={m.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
            <Link to="/meetings/$id" params={{ id: m.id }}>
              <Card className="group h-full p-5 shadow-card transition-all hover:shadow-elegant hover:-translate-y-0.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="line-clamp-1 text-sm font-semibold">{m.title}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">{m.date} · {m.duration}</div>
                  </div>
                  <StatusPill status={m.status} />
                </div>
                <p className="mt-3 line-clamp-2 min-h-[2.5rem] text-xs text-muted-foreground">
                  {m.summary || (m.status === "processing" ? "Generating summary…" : "Not yet started.")}
                </p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {m.tags.map((t) => (
                    <Badge key={t} variant="outline" className="text-[10px]">{t}</Badge>
                  ))}
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
                  <div className="flex -space-x-2">
                    {m.participants.map((p) => (
                      <Avatar key={p} className="h-6 w-6 border-2 border-card">
                        <AvatarFallback className="bg-muted text-[10px]">{p}</AvatarFallback>
                      </Avatar>
                    ))}
                  </div>
                  <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Sparkles className="h-3 w-3 text-primary" /> {m.actionItems} action items
                  </div>
                </div>
              </Card>
            </Link>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  if (status === "processing") {
    return (
      <Badge variant="secondary" className="gap-1">
        <Loader2 className="h-3 w-3 animate-spin" /> Processing
      </Badge>
    );
  }
  if (status === "scheduled") {
    return <Badge variant="outline">Scheduled</Badge>;
  }
  return <Badge className="bg-success/15 text-success hover:bg-success/15">Ready</Badge>;
}
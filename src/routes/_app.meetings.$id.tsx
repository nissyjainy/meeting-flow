import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  ArrowLeft, Play, Pause, Download, Share2, Sparkles, ListChecks, Tag, Smile,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { meetings, transcript, aiSummary, tasks } from "@/lib/mock-data";
import { useState } from "react";

export const Route = createFileRoute("/_app/meetings/$id")({
  loader: ({ params }) => {
    const meeting = meetings.find((m) => m.id === params.id);
    if (!meeting) throw notFound();
    return { meeting };
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData?.meeting.title ?? "Meeting"} — Northstar` },
      { name: "description", content: loaderData?.meeting.summary || "Meeting transcript and AI summary." },
    ],
  }),
  component: MeetingDetail,
  notFoundComponent: () => (
    <div className="p-8">
      <p className="text-sm text-muted-foreground">Meeting not found.</p>
      <Link to="/meetings" className="text-sm text-primary hover:underline">Back to meetings</Link>
    </div>
  ),
});

function MeetingDetail() {
  const { meeting } = Route.useLoaderData();
  const meetingTasks = tasks.filter((t) => t.meetingId === meeting.id);
  const [playing, setPlaying] = useState(false);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 md:px-8">
      <Link to="/meetings" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3 w-3" /> All meetings
      </Link>

      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{meeting.title}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>{meeting.date}</span><span>·</span><span>{meeting.duration}</span><span>·</span>
            <Badge variant="secondary">{meeting.recordingType}</Badge>
            {meeting.tags.map((t: string) => <Badge key={t} variant="outline">{t}</Badge>)}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm"><Share2 className="mr-1.5 h-3.5 w-3.5" /> Share</Button>
          <Button variant="outline" size="sm"><Download className="mr-1.5 h-3.5 w-3.5" /> Export</Button>
          <Button size="sm" className="bg-gradient-primary text-primary-foreground hover:opacity-90">
            <Sparkles className="mr-1.5 h-3.5 w-3.5" /> Ask Copilot
          </Button>
        </div>
      </motion.div>

      <Card className="mt-5 p-4 shadow-card">
        <div className="flex items-center gap-3">
          <Button size="icon" variant="outline" onClick={() => setPlaying(!playing)} className="h-10 w-10 rounded-full">
            {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </Button>
          <div className="flex-1">
            <div className="flex justify-between text-[11px] text-muted-foreground">
              <span>00:14:22</span><span>{meeting.duration}</span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full w-1/3 rounded-full bg-gradient-primary" />
            </div>
          </div>
          <div className="flex -space-x-2">
            {meeting.participants.map((p: string) => (
              <Avatar key={p} className="h-8 w-8 border-2 border-card">
                <AvatarFallback className="bg-muted text-xs">{p}</AvatarFallback>
              </Avatar>
            ))}
          </div>
        </div>
      </Card>

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Tabs defaultValue="transcript">
            <TabsList>
              <TabsTrigger value="transcript">Transcript</TabsTrigger>
              <TabsTrigger value="tasks">Action items <Badge variant="secondary" className="ml-1.5">{meetingTasks.length}</Badge></TabsTrigger>
              <TabsTrigger value="topics">Topics</TabsTrigger>
            </TabsList>

            <TabsContent value="transcript" className="mt-4 space-y-3">
              {transcript.map((line, i) => (
                <motion.div
                  key={line.id}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="flex gap-3 rounded-lg p-3 hover:bg-muted/50"
                >
                  <Avatar className="h-8 w-8 shrink-0"><AvatarFallback className="bg-muted text-xs">{line.speaker.split(" ").map((n) => n[0]).join("")}</AvatarFallback></Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{line.speaker}</span>
                      <span className="text-[11px] text-muted-foreground">{line.time}</span>
                    </div>
                    <p className="mt-1 text-sm text-foreground/90">{line.text}</p>
                  </div>
                </motion.div>
              ))}
            </TabsContent>

            <TabsContent value="tasks" className="mt-4 space-y-2">
              {meetingTasks.map((t) => (
                <Card key={t.id} className="flex items-center gap-3 p-3">
                  <Avatar className="h-7 w-7"><AvatarFallback className="bg-muted text-xs">{t.assignee}</AvatarFallback></Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{t.title}</div>
                    <div className="mt-1"><Progress value={t.progress} className="h-1" /></div>
                  </div>
                  <Badge variant="outline" className="capitalize">{t.priority}</Badge>
                  <span className="text-xs text-muted-foreground">{t.dueDate}</span>
                </Card>
              ))}
              {meetingTasks.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">No action items yet.</p>}
            </TabsContent>

            <TabsContent value="topics" className="mt-4">
              <div className="flex flex-wrap gap-2">
                {aiSummary.topics.map((t) => (
                  <Badge key={t} variant="secondary" className="px-3 py-1 text-xs">{t}</Badge>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <div className="space-y-4">
          <Card className="overflow-hidden shadow-card">
            <div className="flex items-center gap-2 border-b border-border bg-gradient-subtle px-4 py-3">
              <div className="grid h-6 w-6 place-items-center rounded-md bg-gradient-primary">
                <Sparkles className="h-3 w-3 text-primary-foreground" />
              </div>
              <span className="text-sm font-semibold">AI Summary</span>
              <Badge variant="outline" className="ml-auto text-[10px]">GPT-5</Badge>
            </div>
            <div className="space-y-4 p-4">
              <div>
                <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">TL;DR</div>
                <p className="mt-1 text-sm">{aiSummary.tldr}</p>
              </div>
              <div>
                <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Key points</div>
                <ul className="mt-1.5 space-y-1.5 text-sm">
                  {aiSummary.keyPoints.map((p, i) => (
                    <li key={i} className="flex gap-2"><span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary" />{p}</li>
                  ))}
                </ul>
              </div>
              <div>
                <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Decisions</div>
                <ul className="mt-1.5 space-y-1.5 text-sm">
                  {aiSummary.decisions.map((p, i) => (
                    <li key={i} className="flex gap-2"><ListChecks className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />{p}</li>
                  ))}
                </ul>
              </div>
              <div className="flex items-center gap-4 border-t border-border pt-3 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1"><Smile className="h-3 w-3" /> {aiSummary.sentiment}</span>
                <span className="inline-flex items-center gap-1"><Tag className="h-3 w-3" /> {aiSummary.topics.length} topics</span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
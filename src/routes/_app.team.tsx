import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { UserPlus, Mail } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { team } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/team")({
  head: () => ({
    meta: [
      { title: "Team — Northstar" },
      { name: "description", content: "Manage teammates, roles and access in your workspace." },
    ],
  }),
  component: TeamPage,
});

function TeamPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Team members</h1>
          <p className="text-sm text-muted-foreground">{team.length} people in the Northstar workspace.</p>
        </div>
        <Button size="sm" className="bg-gradient-primary text-primary-foreground hover:opacity-90">
          <UserPlus className="mr-1.5 h-3.5 w-3.5" /> Invite teammate
        </Button>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {team.map((m, i) => (
          <motion.div key={m.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
            <Card className="p-5 shadow-card transition-shadow hover:shadow-elegant">
              <div className="flex items-start gap-3">
                <div className="relative">
                  <Avatar className="h-12 w-12">
                    <AvatarFallback className="bg-gradient-primary text-sm text-primary-foreground">{m.avatar}</AvatarFallback>
                  </Avatar>
                  <span
                    className={cn(
                      "absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card",
                      m.status === "online" && "bg-success",
                      m.status === "away" && "bg-warning",
                      m.status === "offline" && "bg-muted-foreground/50",
                    )}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{m.name}</div>
                  <div className="truncate text-xs text-muted-foreground">{m.email}</div>
                  <Badge variant="secondary" className="mt-1.5 text-[10px]">{m.role}</Badge>
                </div>
              </div>
              <div className="mt-4 flex gap-2 border-t border-border pt-3">
                <Button variant="outline" size="sm" className="flex-1"><Mail className="mr-1.5 h-3.5 w-3.5" /> Message</Button>
                <Button variant="ghost" size="sm" className="flex-1">View profile</Button>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
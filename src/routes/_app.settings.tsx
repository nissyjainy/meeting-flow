import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAppStore } from "@/store/app-store";
import { Sparkles, Slack, Github, Calendar, Video } from "lucide-react";

export const Route = createFileRoute("/_app/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Northstar" },
      { name: "description", content: "Workspace, account, AI and integration settings." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { theme, setTheme } = useAppStore();

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 md:px-8">
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
      <p className="text-sm text-muted-foreground">Manage your workspace, account and AI preferences.</p>

      <Tabs defaultValue="account" className="mt-6">
        <TabsList>
          <TabsTrigger value="account">Account</TabsTrigger>
          <TabsTrigger value="workspace">Workspace</TabsTrigger>
          <TabsTrigger value="ai">AI Copilot</TabsTrigger>
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
        </TabsList>

        <TabsContent value="account" className="mt-5 space-y-4">
          <Card className="p-6">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16"><AvatarFallback className="bg-gradient-primary text-base text-primary-foreground">DP</AvatarFallback></Avatar>
              <div>
                <div className="text-sm font-semibold">Daniel Park</div>
                <div className="text-xs text-muted-foreground">daniel@northstar.io</div>
                <Button variant="outline" size="sm" className="mt-2">Change photo</Button>
              </div>
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <Field label="Full name" defaultValue="Daniel Park" />
              <Field label="Email" defaultValue="daniel@northstar.io" type="email" />
              <Field label="Job title" defaultValue="Founder / CEO" />
              <Field label="Timezone" defaultValue="America / Los Angeles" />
            </div>
            <div className="mt-6 flex justify-end gap-2 border-t border-border pt-4">
              <Button variant="ghost" size="sm">Cancel</Button>
              <Button size="sm">Save changes</Button>
            </div>
          </Card>

          <Card className="p-6">
            <div className="text-sm font-semibold">Appearance</div>
            <p className="text-xs text-muted-foreground">Pick how Northstar looks on this device.</p>
            <div className="mt-4 flex gap-2">
              {(["light", "dark"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTheme(t)}
                  className={`flex-1 rounded-lg border-2 p-3 text-left text-sm capitalize transition ${theme === t ? "border-primary bg-accent/50" : "border-border hover:border-muted-foreground/30"}`}
                >
                  {t} mode
                </button>
              ))}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="workspace" className="mt-5 space-y-4">
          <Card className="p-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Workspace name" defaultValue="Northstar" />
              <Field label="Workspace URL" defaultValue="northstar.app/wks" />
            </div>
            <ToggleRow title="Auto-record meetings" desc="Copilot joins every calendar meeting automatically." />
            <ToggleRow title="Default share with team" desc="New transcripts are visible to your workspace." defaultChecked />
          </Card>
        </TabsContent>

        <TabsContent value="ai" className="mt-5 space-y-4">
          <Card className="p-6">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <div className="text-sm font-semibold">Copilot behavior</div>
            </div>
            <ToggleRow title="Auto-extract action items" desc="Tasks are generated after every meeting." defaultChecked />
            <ToggleRow title="Suggest meeting follow-ups" desc="Draft emails and summaries automatically." defaultChecked />
            <ToggleRow title="Train on my workspace" desc="Use my meetings to personalize Copilot answers." />
            <div className="mt-4">
              <Label className="text-xs">Default summary length</Label>
              <div className="mt-2 flex gap-2">
                {["Concise", "Standard", "Detailed"].map((l, i) => (
                  <Button key={l} variant={i === 1 ? "default" : "outline"} size="sm">{l}</Button>
                ))}
              </div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="integrations" className="mt-5 grid gap-3 sm:grid-cols-2">
          <IntegrationCard icon={Video} name="Zoom" desc="Auto-import recordings" connected />
          <IntegrationCard icon={Calendar} name="Google Calendar" desc="Sync meetings & invites" connected />
          <IntegrationCard icon={Slack} name="Slack" desc="Post summaries to channels" />
          <IntegrationCard icon={Github} name="GitHub" desc="Link tasks to PRs and issues" />
        </TabsContent>

        <TabsContent value="billing" className="mt-5">
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold">Pro plan</div>
                <p className="text-xs text-muted-foreground">$24 per user / month · billed annually</p>
              </div>
              <Badge className="bg-gradient-primary text-primary-foreground">Active</Badge>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <Stat label="Seats used" value="6 / 10" />
              <Stat label="Hours transcribed" value="184h" />
              <Stat label="Next invoice" value="Jan 12" />
            </div>
            <Button variant="outline" size="sm" className="mt-5">Manage subscription</Button>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Field({ label, defaultValue, type = "text" }: { label: string; defaultValue: string; type?: string }) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Input defaultValue={defaultValue} type={type} className="mt-1.5" />
    </div>
  );
}

function ToggleRow({ title, desc, defaultChecked }: { title: string; desc: string; defaultChecked?: boolean }) {
  return (
    <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
      <div className="pr-6">
        <div className="text-sm font-medium">{title}</div>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
      <Switch defaultChecked={defaultChecked} />
    </div>
  );
}

function IntegrationCard({ icon: Icon, name, desc, connected }: { icon: typeof Slack; name: string; desc: string; connected?: boolean }) {
  return (
    <Card className="flex items-center gap-3 p-4">
      <div className="grid h-10 w-10 place-items-center rounded-lg bg-accent text-accent-foreground">
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium">{name}</div>
        <div className="truncate text-xs text-muted-foreground">{desc}</div>
      </div>
      <Button variant={connected ? "outline" : "default"} size="sm">{connected ? "Connected" : "Connect"}</Button>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-semibold">{value}</div>
    </div>
  );
}
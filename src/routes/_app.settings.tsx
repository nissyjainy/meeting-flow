import { createFileRoute, useRouteContext } from "@tanstack/react-router";
import { useEffect } from "react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { GoogleCalendarConnect } from "@/components/integrations/GoogleCalendarConnect";
import { useAppStore } from "@/store/app-store";
import { EmptyStateCard } from "@/components/ui/empty-state-card";

const WORKSPACE_NAME = "Northstar";

function userInitials(fullName: string | null | undefined, email: string): string {
  if (fullName?.trim()) {
    return fullName
      .trim()
      .split(/\s+/)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  }
  return email.slice(0, 2).toUpperCase();
}

export const Route = createFileRoute("/_app/settings")({
  validateSearch: (search: Record<string, unknown>) => ({
    tab: typeof search.tab === "string" ? search.tab : undefined,
    connected: search.connected === "1" || search.connected === true || search.connected === "true",
    error: typeof search.error === "string" ? search.error : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Settings — Northstar" },
      { name: "description", content: "Account and workspace settings." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { user } = useRouteContext({ from: "__root__" });
  const { theme, setTheme } = useAppStore();
  const { tab, connected, error } = Route.useSearch();

  const displayName = user?.fullName?.trim() || "Account";
  const email = user?.email ?? "";
  const defaultTab =
    tab === "integrations" || tab === "workspace" || tab === "ai" || tab === "billing"
      ? tab
      : "account";

  useEffect(() => {
    if (connected) {
      toast.success("Google Calendar connected", {
        description: "Upcoming meetings will appear under Scheduled.",
      });
    }
  }, [connected]);

  useEffect(() => {
    if (error) {
      toast.error("Google Calendar connection failed", { description: error });
    }
  }, [error]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 md:px-8">
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
      <p className="text-sm text-muted-foreground">Manage your account and workspace preferences.</p>

      <Tabs defaultValue={defaultTab} className="mt-6">
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1">
          <TabsTrigger value="account">Account</TabsTrigger>
          <TabsTrigger value="workspace">Workspace</TabsTrigger>
          <TabsTrigger value="ai">AI Copilot</TabsTrigger>
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
        </TabsList>

        <TabsContent value="account" className="mt-5 space-y-4">
          <Card className="p-6 shadow-card">
            <div className="flex flex-wrap items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarFallback className="bg-gradient-primary text-base text-primary-foreground">
                  {user ? userInitials(user.fullName, user.email) : "?"}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">{displayName}</div>
                <div className="truncate text-xs text-muted-foreground">{email || "Not signed in"}</div>
              </div>
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div>
                <Label className="text-xs">Full name</Label>
                <Input value={displayName} readOnly className="mt-1.5 bg-muted/30" />
              </div>
              <div>
                <Label className="text-xs">Email</Label>
                <Input value={email} readOnly type="email" className="mt-1.5 bg-muted/30" />
              </div>
            </div>
          </Card>

          <Card className="p-6 shadow-card">
            <div className="text-sm font-semibold">Appearance</div>
            <p className="text-xs text-muted-foreground">Pick how Northstar looks on this device.</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {(["light", "dark"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setTheme(value)}
                  className={`rounded-lg border-2 p-3 text-left text-sm capitalize transition ${
                    theme === value
                      ? "border-primary bg-accent/50"
                      : "border-border hover:border-muted-foreground/30"
                  }`}
                >
                  {value} mode
                </button>
              ))}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="workspace" className="mt-5 space-y-4">
          <Card className="p-6 shadow-card">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label className="text-xs">Workspace name</Label>
                <Input value={WORKSPACE_NAME} readOnly className="mt-1.5 bg-muted/30" />
              </div>
              <div>
                <Label className="text-xs">Signed in as</Label>
                <Input value={email} readOnly className="mt-1.5 bg-muted/30" />
              </div>
            </div>
          </Card>
          <ComingSoonCard description="Workspace sharing, URLs, and team defaults are not available yet." />
        </TabsContent>

        <TabsContent value="ai" className="mt-5">
          <ComingSoonCard description="Copilot preferences and summary defaults are not available yet." />
        </TabsContent>

        <TabsContent value="integrations" className="mt-5 space-y-4">
          <GoogleCalendarConnect />
          <ComingSoonCard description="Zoom, Slack, and GitHub integrations are not available yet." />
        </TabsContent>

        <TabsContent value="billing" className="mt-5">
          <ComingSoonCard description="Subscription and usage billing are not available yet." />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ComingSoonCard({ description }: { description: string }) {
  return (
    <EmptyStateCard
      title="Coming soon"
      description={description}
      className="shadow-card"
    />
  );
}

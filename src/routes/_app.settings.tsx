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
import { Badge } from "@/components/ui/badge";
import { featureFlags, SETTINGS_ROADMAP_TABS } from "@/lib/feature-flags";
import { DEFAULT_WORKSPACE_NAME, pageTitle, PRODUCT_NAME } from "@/lib/branding";

const WORKSPACE_NAME = DEFAULT_WORKSPACE_NAME;

const SETTINGS_TABS = ["account", "workspace", "ai", "integrations", "billing"] as const;
type SettingsTab = (typeof SETTINGS_TABS)[number];

function isSettingsTab(value: string | undefined): value is SettingsTab {
  return SETTINGS_TABS.includes(value as SettingsTab);
}

function isVisibleSettingsTab(tab: SettingsTab): boolean {
  if (tab === "ai") return featureFlags.settingsAiAssistantTab;
  if (tab === "billing") return featureFlags.settingsBillingTab;
  return true;
}

function resolveSettingsTab(tab: string | undefined): SettingsTab {
  if (tab && isSettingsTab(tab) && isVisibleSettingsTab(tab)) {
    return tab;
  }
  return "account";
}

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
      { title: pageTitle("Settings") },
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
  const defaultTab = resolveSettingsTab(tab);

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
          {featureFlags.settingsAiAssistantTab ? (
            <SettingsTabTrigger value="ai" label="Assistant" />
          ) : null}
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
          {featureFlags.settingsBillingTab ? (
            <SettingsTabTrigger value="billing" label="Billing" />
          ) : null}
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
            <p className="text-xs text-muted-foreground">Pick how {PRODUCT_NAME} looks on this device.</p>
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
          <ComingSoonCard
            title="Planned workspace features"
            description={`${PRODUCT_NAME} uses a single workspace today — your name and sign-in are shown above. Link task owner emails per meeting from the Team page or each meeting's Team Members section. Shared workspaces, invite links, and organization-wide defaults are on the roadmap.`}
          />
        </TabsContent>

        {featureFlags.settingsAiAssistantTab ? (
          <TabsContent value="ai" className="mt-5 space-y-3">
            <ComingSoonCard
              title="Assistant settings"
              description="MeetFlow Assistant is available from the sidebar or any meeting page — ask about summaries, action items, owners, deadlines, and workspace analytics. Preferences such as summary tone, default prompts, and workspace-wide Assistant policies will be configurable here in a future release."
            />
          </TabsContent>
        ) : null}

        <TabsContent value="integrations" className="mt-5 space-y-4">
          <GoogleCalendarConnect />
          <ComingSoonCard
            title="More integrations"
            description="Google Calendar is available above — connect to import upcoming meetings into the Scheduled tab on Meetings. Zoom, Microsoft Teams, Slack, and GitHub integrations are on the roadmap."
          />
        </TabsContent>

        {featureFlags.settingsBillingTab ? (
          <TabsContent value="billing" className="mt-5 space-y-3">
            <ComingSoonCard
              title="Billing & plans"
              description={`Subscription tiers, usage-based billing, and invoicing are on the ${PRODUCT_NAME} roadmap. The current MVP does not require a paid plan or payment setup.`}
            />
            <RoadmapNote />
          </TabsContent>
        ) : null}
      </Tabs>
    </div>
  );
}

function SettingsTabTrigger({ value, label }: { value: SettingsTab; label: string }) {
  const isRoadmap = SETTINGS_ROADMAP_TABS.has(value);

  return (
    <TabsTrigger value={value} className="gap-1.5">
      {label}
      {isRoadmap ? (
        <Badge
          variant="secondary"
          className="pointer-events-none border-border/60 px-1.5 py-0 text-[10px] font-medium leading-4"
        >
          Coming Soon
        </Badge>
      ) : null}
    </TabsTrigger>
  );
}

function RoadmapNote() {
  return (
    <p className="text-center text-xs text-muted-foreground">
      On the {PRODUCT_NAME} roadmap — not included in the current MVP.
    </p>
  );
}

function ComingSoonCard({
  title = "Coming soon",
  description,
}: {
  title?: string;
  description: string;
}) {
  return (
    <EmptyStateCard title={title} description={description} className="shadow-card" />
  );
}

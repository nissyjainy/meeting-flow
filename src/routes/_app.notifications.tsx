import { createFileRoute } from "@tanstack/react-router";
import { CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NotificationsList } from "@/components/notifications/NotificationsList";
import { useNotifications } from "@/hooks/use-notifications";
import { useState } from "react";
import type { NotificationTab } from "@/lib/notifications/present-notifications";
import { pageTitle } from "@/lib/branding";

export const Route = createFileRoute("/_app/notifications")({
  head: () => ({
    meta: [
      { title: pageTitle("Notifications") },
      { name: "description", content: "Mentions, reminders and AI updates in one focused inbox." },
    ],
  }),
  component: NotificationsPage,
});

function NotificationsPage() {
  const { notifications, isLoading, isError, error, refetch, markAllRead, markRead } =
    useNotifications();
  const [tab, setTab] = useState<NotificationTab>("all");

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 md:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Notifications</h1>
          <p className="text-sm text-muted-foreground">
            Stay on top of what your team and Copilot are doing.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={markAllRead}
          disabled={isLoading || notifications.length === 0}
        >
          <CheckCheck className="mr-1.5 h-3.5 w-3.5" /> Mark all as read
        </Button>
      </div>

      <Tabs value={tab} onValueChange={(value) => setTab(value as NotificationTab)} className="mt-6">
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="unread">Unread</TabsTrigger>
        </TabsList>
      </Tabs>

      <NotificationsList
        notifications={notifications}
        tab={tab}
        isLoading={isLoading}
        isError={isError}
        error={error}
        onRetry={() => refetch()}
        onMarkRead={markRead}
      />
    </div>
  );
}

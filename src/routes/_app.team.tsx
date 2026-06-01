import { createFileRoute, Link } from "@tanstack/react-router";
import { UserPlus, Mail } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useAllTasks } from "@/hooks/use-all-tasks";
import { createClient } from "@/lib/supabase/client";
import { computeTeamInsights, type OwnerInsightRow } from "@/lib/tasks/team-insights";
import { EmptyStateCard } from "@/components/ui/empty-state-card";
import { cn } from "@/lib/utils";

const UNASSIGNED_OWNER_KEY = "__unassigned__";

type WorkspaceTeamMember = {
  name: string;
  email: string;
};

export const Route = createFileRoute("/_app/team")({
  head: () => ({
    meta: [
      { title: "Team — Northstar" },
      { name: "description", content: "Task owners and workload from your meeting action items." },
    ],
  }),
  component: TeamPage,
});

function activeOwnersFromTasks(tasks: Parameters<typeof computeTeamInsights>[0]): OwnerInsightRow[] {
  return computeTeamInsights(tasks).owners.filter(
    (owner) => owner.ownerKey !== UNASSIGNED_OWNER_KEY,
  );
}

function buildOwnerEmailMap(members: WorkspaceTeamMember[]): Map<string, string> {
  const map = new Map<string, string>();

  for (const member of members) {
    const key = member.name.trim().toLowerCase();
    const email = member.email.trim();
    if (!key || !email || map.has(key)) continue;
    map.set(key, email);
  }

  return map;
}

function resolveOwnerEmail(ownerLabel: string, ownerEmailByKey: Map<string, string>): string | null {
  const key = ownerLabel.trim().toLowerCase();
  if (!key) return null;
  return ownerEmailByKey.get(key) ?? null;
}

async function openOwnerMessage(email: string): Promise<void> {
  const mailtoUrl = `mailto:${encodeURIComponent(email)}`;

  window.location.assign(mailtoUrl);

  try {
    await navigator.clipboard.writeText(email);
    toast.message("Opening mail app", {
      description: `${email} copied to clipboard if your mail client did not open.`,
    });
  } catch {
    toast.message("Opening mail app", { description: email });
  }
}

function OwnerEmailStatus({
  email,
  loading,
}: {
  email: string | null;
  loading: boolean;
}) {
  if (loading) {
    return <p className="mt-0.5 text-xs text-muted-foreground">Loading email…</p>;
  }

  if (email) {
    return (
      <p className="mt-0.5 break-all text-xs text-muted-foreground" title={email}>
        {email}
      </p>
    );
  }

  return (
    <p className="mt-0.5 text-xs text-muted-foreground">
      No email on file — add on a meeting page
    </p>
  );
}

function MessageButton({
  email,
  className,
  fullWidth = false,
}: {
  email: string | null;
  className?: string;
  fullWidth?: boolean;
}) {
  const disabled = !email;
  const title = email
    ? `Message ${email}`
    : "No email on file — add this person on a meeting page";

  return (
    <Button
      variant="outline"
      size="sm"
      className={cn(fullWidth ? "w-full" : "h-8 px-2.5", className)}
      disabled={disabled}
      title={title}
      onClick={() => {
        if (!email) return;
        void openOwnerMessage(email);
      }}
    >
      <span className={cn("inline-flex items-center gap-1.5", fullWidth && "justify-center w-full")}>
        <Mail className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <span>Message</span>
      </span>
    </Button>
  );
}

function OwnerActions({
  owner,
  email,
  onView,
}: {
  owner: OwnerInsightRow;
  email: string | null;
  onView: (owner: OwnerInsightRow) => void;
}) {
  return (
    <div className="flex items-center justify-end gap-2">
      <MessageButton email={email} />
      <Button
        variant="ghost"
        size="sm"
        className="h-8 px-3"
        onClick={() => onView(owner)}
      >
        View
      </Button>
    </div>
  );
}

function TeamDirectoryTable({
  owners,
  ownerEmailByKey,
  membersLoading,
  onView,
}: {
  owners: OwnerInsightRow[];
  ownerEmailByKey: Map<string, string>;
  membersLoading: boolean;
  onView: (owner: OwnerInsightRow) => void;
}) {
  return (
    <Card className="hidden min-w-0 overflow-hidden shadow-card md:block">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] table-fixed">
          <colgroup>
            <col className="w-[26%]" />
            <col className="w-[11%]" />
            <col className="w-[11%]" />
            <col className="w-[11%]" />
            <col className="w-[14%]" />
            <col className="w-[27%]" />
          </colgroup>
          <thead>
            <tr className="border-b border-border bg-muted/20 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-3 text-left font-semibold sm:px-5">Owner</th>
              <th className="px-2 py-3 text-right font-semibold">Assigned</th>
              <th className="px-2 py-3 text-right font-semibold">Completed</th>
              <th className="px-2 py-3 text-right font-semibold">Overdue</th>
              <th className="px-2 py-3 text-right font-semibold whitespace-nowrap">
                Completion Rate
              </th>
              <th className="px-4 py-3 text-right font-semibold sm:px-5">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {owners.map((owner) => {
              const email = resolveOwnerEmail(owner.ownerLabel, ownerEmailByKey);

              return (
                <tr key={owner.ownerKey} className="transition-colors hover:bg-muted/20">
                  <td className="px-4 py-3 sm:px-5">
                    <p className="break-words text-sm font-semibold text-foreground">
                      {owner.ownerLabel}
                    </p>
                    <OwnerEmailStatus email={email} loading={membersLoading} />
                  </td>
                  <td className="px-2 py-3 text-right text-sm tabular-nums text-foreground">
                    {owner.assigned}
                  </td>
                  <td className="px-2 py-3 text-right text-sm tabular-nums text-foreground">
                    {owner.completed}
                  </td>
                  <td
                    className={cn(
                      "px-2 py-3 text-right text-sm tabular-nums",
                      owner.overdue > 0 ? "font-medium text-destructive" : "text-muted-foreground",
                    )}
                  >
                    {owner.overdue}
                  </td>
                  <td className="px-2 py-3 text-right text-sm font-semibold tabular-nums text-foreground">
                    {owner.completionRate}%
                  </td>
                  <td className="px-4 py-2.5 sm:px-5">
                    <OwnerActions owner={owner} email={email} onView={onView} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function TeamDirectoryMobileCard({
  owner,
  email,
  membersLoading,
  onView,
}: {
  owner: OwnerInsightRow;
  email: string | null;
  membersLoading: boolean;
  onView: (owner: OwnerInsightRow) => void;
}) {
  return (
    <Card className="p-4 shadow-card">
      <p className="break-words text-sm font-semibold text-foreground">{owner.ownerLabel}</p>
      <OwnerEmailStatus email={email} loading={membersLoading} />

      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <div>
          <dt className="text-xs text-muted-foreground">Assigned Tasks</dt>
          <dd className="mt-0.5 font-medium tabular-nums text-foreground">{owner.assigned}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Completed</dt>
          <dd className="mt-0.5 font-medium tabular-nums text-foreground">{owner.completed}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Overdue</dt>
          <dd
            className={cn(
              "mt-0.5 font-medium tabular-nums",
              owner.overdue > 0 ? "text-destructive" : "text-foreground",
            )}
          >
            {owner.overdue}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Completion Rate</dt>
          <dd className="mt-0.5 font-semibold tabular-nums text-foreground">
            {owner.completionRate}%
          </dd>
        </div>
      </dl>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <MessageButton email={email} fullWidth />
        <Button variant="ghost" size="sm" className="w-full" onClick={() => onView(owner)}>
          View
        </Button>
      </div>
    </Card>
  );
}

function TeamDirectoryMobileList({
  owners,
  ownerEmailByKey,
  membersLoading,
  onView,
}: {
  owners: OwnerInsightRow[];
  ownerEmailByKey: Map<string, string>;
  membersLoading: boolean;
  onView: (owner: OwnerInsightRow) => void;
}) {
  return (
    <div className="space-y-3 md:hidden">
      {owners.map((owner) => (
        <TeamDirectoryMobileCard
          key={owner.ownerKey}
          owner={owner}
          email={resolveOwnerEmail(owner.ownerLabel, ownerEmailByKey)}
          membersLoading={membersLoading}
          onView={onView}
        />
      ))}
    </div>
  );
}

function OwnerDetailsDialog({
  owner,
  open,
  onOpenChange,
}: {
  owner: OwnerInsightRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{owner?.ownerLabel ?? "Owner details"}</DialogTitle>
          <DialogDescription>Task accountability for this owner.</DialogDescription>
        </DialogHeader>

        {owner ? (
          <dl className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-border/60 bg-muted/10 px-3 py-2.5">
              <dt className="text-xs text-muted-foreground">Assigned tasks</dt>
              <dd className="mt-1 text-lg font-semibold tabular-nums">{owner.assigned}</dd>
            </div>
            <div className="rounded-lg border border-border/60 bg-muted/10 px-3 py-2.5">
              <dt className="text-xs text-muted-foreground">Completed tasks</dt>
              <dd className="mt-1 text-lg font-semibold tabular-nums">{owner.completed}</dd>
            </div>
            <div className="rounded-lg border border-border/60 bg-muted/10 px-3 py-2.5">
              <dt className="text-xs text-muted-foreground">Overdue tasks</dt>
              <dd
                className={cn(
                  "mt-1 text-lg font-semibold tabular-nums",
                  owner.overdue > 0 ? "text-destructive" : "text-foreground",
                )}
              >
                {owner.overdue}
              </dd>
            </div>
            <div className="rounded-lg border border-border/60 bg-muted/10 px-3 py-2.5">
              <dt className="text-xs text-muted-foreground">Completion rate</dt>
              <dd className="mt-1 text-lg font-semibold tabular-nums">{owner.completionRate}%</dd>
            </div>
          </dl>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function InviteTeammateDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  useEffect(() => {
    if (!open) {
      setName("");
      setEmail("");
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Link owner email</DialogTitle>
          <DialogDescription>
            Add name and email on each meeting&apos;s Team Members section so reminders can reach
            the right person.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="invite-name">Name</Label>
            <Input
              id="invite-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Alex Morgan"
              autoComplete="name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="invite-email">Email</Label>
            <Input
              id="invite-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="alex@company.com"
              autoComplete="email"
            />
          </div>
          {name.trim() || email.trim() ? (
            <p className="rounded-lg border border-border/60 bg-muted/10 px-3 py-2.5 text-sm text-muted-foreground">
              To link{" "}
              <span className="font-medium text-foreground">{name.trim() || "this teammate"}</span>
              {email.trim() ? (
                <>
                  {" "}
                  (<span className="text-foreground">{email.trim()}</span>)
                </>
              ) : null}
              , open a meeting and add them in the Team Members section.
            </p>
          ) : null}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button asChild className="bg-gradient-primary text-primary-foreground hover:opacity-90">
            <Link to="/meetings">Go to meetings</Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TeamDirectoryTableSkeleton() {
  return (
    <Card className="hidden min-w-0 overflow-hidden shadow-card md:block">
      <div className="border-b border-border bg-muted/20 px-5 py-3">
        <Skeleton className="h-3 w-full max-w-md" />
      </div>
      <div className="divide-y divide-border/60 px-5 py-2">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="flex items-center gap-4 py-3">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="ml-auto h-4 w-8" />
            <Skeleton className="h-4 w-8" />
            <Skeleton className="h-4 w-8" />
            <Skeleton className="h-4 w-10" />
            <Skeleton className="h-8 w-36" />
          </div>
        ))}
      </div>
    </Card>
  );
}

function TeamDirectoryMobileSkeleton() {
  return (
    <div className="space-y-3 md:hidden">
      {Array.from({ length: 3 }, (_, index) => (
        <Card key={index} className="p-4 shadow-card">
          <Skeleton className="h-4 w-36" />
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Skeleton className="h-9" />
            <Skeleton className="h-9" />
          </div>
        </Card>
      ))}
    </div>
  );
}

function TeamPage() {
  const { data: tasks = [], isLoading, isError } = useAllTasks();
  const [teamMembers, setTeamMembers] = useState<WorkspaceTeamMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [viewOwner, setViewOwner] = useState<OwnerInsightRow | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadTeamMembers() {
      setMembersLoading(true);
      const supabase = createClient();
      const { data, error } = await supabase.from("team_members").select("name, email");

      if (cancelled) return;

      if (error) {
        console.error("[team] failed to load team_members for email lookup", error.message);
        setTeamMembers([]);
        setMembersLoading(false);
        return;
      }

      setTeamMembers(
        (data ?? []).map((row) => ({
          name: row.name != null ? String(row.name) : "",
          email: row.email != null ? String(row.email) : "",
        })),
      );
      setMembersLoading(false);
    }

    void loadTeamMembers();

    return () => {
      cancelled = true;
    };
  }, []);

  const ownerEmailByKey = useMemo(() => buildOwnerEmailMap(teamMembers), [teamMembers]);

  const owners = useMemo(() => {
    if (isLoading || isError) return [];
    return activeOwnersFromTasks(tasks);
  }, [tasks, isLoading, isError]);

  const activeOwnerCount = owners.length;

  return (
    <div className="mx-auto min-w-0 max-w-7xl px-4 py-8 md:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Team members</h1>
          <p className="text-sm text-muted-foreground">
            {isLoading
              ? "Loading owners…"
              : `${activeOwnerCount} active owner${activeOwnerCount === 1 ? "" : "s"}`}
          </p>
        </div>
        <Button
          size="sm"
          className="bg-gradient-primary text-primary-foreground hover:opacity-90"
          onClick={() => setInviteOpen(true)}
        >
          <UserPlus className="mr-1.5 h-3.5 w-3.5" /> Link owner email
        </Button>
      </div>

      {isError ? (
        <p className="mt-6 rounded-xl border border-border bg-muted/20 px-4 py-12 text-center text-sm text-muted-foreground">
          Could not load task owners. Try refreshing the page.
        </p>
      ) : isLoading ? (
        <div className="mt-6">
          <TeamDirectoryTableSkeleton />
          <TeamDirectoryMobileSkeleton />
        </div>
      ) : owners.length === 0 ? (
        <EmptyStateCard
          className="mt-6"
          title="No active owners"
          description="Action items with assigned owners will appear here after meeting processing."
        />
      ) : (
        <div className="mt-6">
          <TeamDirectoryTable
            owners={owners}
            ownerEmailByKey={ownerEmailByKey}
            membersLoading={membersLoading}
            onView={setViewOwner}
          />
          <TeamDirectoryMobileList
            owners={owners}
            ownerEmailByKey={ownerEmailByKey}
            membersLoading={membersLoading}
            onView={setViewOwner}
          />
        </div>
      )}

      <InviteTeammateDialog open={inviteOpen} onOpenChange={setInviteOpen} />
      <OwnerDetailsDialog
        owner={viewOwner}
        open={viewOwner != null}
        onOpenChange={(open) => {
          if (!open) setViewOwner(null);
        }}
      />
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";

type TeamMember = {
  id: string;
  name: string;
  email: string;
};

type TeamMemberRow = {
  id: string;
  name: string;
  email: string;
};

export type TeamMembersSectionProps = {
  meetingId: string;
};

const createEmptyMember = (): TeamMember => ({
  id: crypto.randomUUID(),
  name: "",
  email: "",
});

function mapTeamMemberRows(rows: TeamMemberRow[]): TeamMember[] {
  return rows.map((row) => ({
    id: String(row.id),
    name: row.name ?? "",
    email: row.email ?? "",
  }));
}

export function TeamMembersSection({ meetingId }: TeamMembersSectionProps) {
  const supabase = createClient();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function fetchMembers() {
      setLoading(true);
      setLoadError(null);
      setSaved(false);

      const { data, error } = await supabase
        .from("team_members")
        .select("id, name, email")
        .eq("meeting_id", meetingId)
        .order("created_at", { ascending: true });

      if (cancelled) return;

      if (error) {
        console.error("Failed to load team members:", error.message);
        setLoadError("Could not load team members. Try refreshing the page.");
        setMembers([createEmptyMember()]);
        setLoading(false);
        return;
      }

      if (data && data.length > 0) {
        setMembers(mapTeamMemberRows(data));
      } else {
        setMembers([createEmptyMember()]);
      }

      setLoading(false);
    }

    void fetchMembers();

    return () => {
      cancelled = true;
    };
  }, [meetingId]);

  const handleAdd = () => {
    setMembers((prev) => [...prev, createEmptyMember()]);
    setSaved(false);
    setSaveError(null);
  };

  const handleRemove = (id: string) => {
    setMembers((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((m) => m.id !== id);
    });
    setSaved(false);
    setSaveError(null);
  };

  const handleChange = (id: string, field: "name" | "email", value: string) => {
    setMembers((prev) =>
      prev.map((m) => (m.id === id ? { ...m, [field]: value } : m)),
    );
    setSaved(false);
    setSaveError(null);
  };

  const handleSave = async () => {
    const emptyFields = members.some(
      (m) => m.name.trim() === "" || m.email.trim() === "",
    );
    if (emptyFields) {
      setSaveError("All members must have a name and email.");
      return;
    }

    setSaveError(null);
    setSaving(true);

    try {
      const rows = members.map((m) => ({
        meeting_id: meetingId,
        name: m.name.trim(),
        email: m.email.trim(),
      }));

      const { error: deleteError } = await supabase
        .from("team_members")
        .delete()
        .eq("meeting_id", meetingId);

      if (deleteError) throw deleteError;

      const { data, error: insertError } = await supabase
        .from("team_members")
        .insert(rows)
        .select("id, name, email");

      if (insertError) throw insertError;

      setMembers(mapTeamMemberRows(data ?? []));
      setSaved(true);
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : "Failed to save team members.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="w-full">
      <div className="flex w-full flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Team Members</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Add attendees so reminders can be delivered automatically.
          </p>
        </div>

        {!loading && members.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? "Saving..." : saved ? "Saved" : "Save"}
          </Button>
        )}
      </div>

      <Card className="mt-4 w-full p-4 shadow-card">
        {loading ? (
          <div className="flex h-24 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <ul className="space-y-3">
              {members.map((member) => (
                <li
                  key={member.id}
                  className="flex flex-col gap-2 rounded-lg border border-border bg-muted/20 p-3 sm:flex-row sm:items-end"
                >
                  <div className="flex-1 space-y-1">
                    <Label className="text-xs">Name</Label>

                    <Input
                      placeholder="Jane Smith"
                      value={member.name}
                      onChange={(e) =>
                        handleChange(member.id, "name", e.target.value)
                      }
                      className="h-9"
                    />
                  </div>

                  <div className="flex-1 space-y-1">
                    <Label className="text-xs">Email</Label>

                    <Input
                      type="email"
                      placeholder="jane@example.com"
                      value={member.email}
                      onChange={(e) =>
                        handleChange(member.id, "email", e.target.value)
                      }
                      className="h-9"
                    />
                  </div>

                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 shrink-0 self-end text-muted-foreground hover:text-destructive"
                    onClick={() => handleRemove(member.id)}
                    disabled={members.length <= 1}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>

            <Button
              variant="outline"
              size="sm"
              className="mt-3 w-full"
              onClick={handleAdd}
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Add Member
            </Button>
          </>
        )}

        {loadError && (
          <p className="mt-3 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {loadError}
          </p>
        )}

        {saveError && (
          <p className="mt-3 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {saveError}
          </p>
        )}

        {saved && (
          <p className="mt-3 rounded-lg bg-primary/10 px-3 py-2 text-xs text-primary">
            Team members saved.
          </p>
        )}
      </Card>
    </section>
  );
}

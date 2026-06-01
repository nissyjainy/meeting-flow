import type { TeamMemberRecord } from "./task-reminder-types";

export function normalizeOwnerName(value: string | null | undefined): string {
  return value?.trim().toLowerCase() ?? "";
}

export function findTeamMemberForOwner(
  owner: string | null | undefined,
  teamMembers: TeamMemberRecord[],
): TeamMemberRecord | null {
  const normalizedOwner = normalizeOwnerName(owner);
  if (!normalizedOwner) return null;

  return (
    teamMembers.find((member) => normalizeOwnerName(member.name) === normalizedOwner) ?? null
  );
}

export function findTeamMemberEmailForOwner(
  owner: string | null | undefined,
  teamMembers: TeamMemberRecord[],
): string | null {
  const email = findTeamMemberForOwner(owner, teamMembers)?.email?.trim();
  return email || null;
}

export function mapTeamMemberRows(
  rows: Array<{ id: unknown; name: unknown; email: unknown }>,
): TeamMemberRecord[] {
  return rows.map((row) => ({
    id: String(row.id),
    name: row.name != null ? String(row.name) : "",
    email: row.email != null ? String(row.email) : "",
  }));
}

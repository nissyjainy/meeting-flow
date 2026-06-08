/**
 * Apply idempotent meetings schema gaps to the linked Supabase project.
 *
 * Requires one of:
 *   DATABASE_URL=postgresql://...
 *   SUPABASE_DB_PASSWORD=...  (uses project ref uzddznccxnolcarxykbc by default)
 *
 * Usage:
 *   node scripts/apply-meetings-schema.mjs
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import postgres from "postgres";

const PROJECT_REF = process.env.SUPABASE_PROJECT_REF ?? "uzddznccxnolcarxykbc";

function loadDotEnvLocal() {
  const path = resolve(process.cwd(), ".env.local");
  if (!existsSync(path)) return;

  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] == null) {
      process.env[key] = value;
    }
  }
}

function resolveDatabaseUrl() {
  if (process.env.DATABASE_URL?.trim()) {
    return process.env.DATABASE_URL.trim();
  }

  const password = process.env.SUPABASE_DB_PASSWORD?.trim();
  if (!password) {
    throw new Error(
      "Set DATABASE_URL or SUPABASE_DB_PASSWORD to apply migrations (Supabase Dashboard → Project Settings → Database).",
    );
  }

  const host = process.env.SUPABASE_DB_HOST ?? `db.${PROJECT_REF}.supabase.co`;
  return `postgresql://postgres:${encodeURIComponent(password)}@${host}:5432/postgres`;
}

const STATEMENTS = [
  `alter table public.meetings add column if not exists transcript_error text`,
  `notify pgrst, 'reload schema'`,
];

loadDotEnvLocal();

const sql = postgres(resolveDatabaseUrl(), { ssl: "require", max: 1 });

try {
  for (const statement of STATEMENTS) {
    console.log(`[apply-meetings-schema] executing: ${statement}`);
    await sql.unsafe(statement);
  }
  console.log("[apply-meetings-schema] done");
} finally {
  await sql.end({ timeout: 5 });
}

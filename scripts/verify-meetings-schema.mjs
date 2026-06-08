import { readFileSync, existsSync } from "node:fs";

function loadDotEnvLocal() {
  const path = ".env.local";
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
    if (process.env[key] == null) process.env[key] = value;
  }
}

loadDotEnvLocal();

const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const res = await fetch(
  `${url}/rest/v1/meetings?select=id,file_name,file_url,transcript,summary,status,transcript_error,created_at&limit=1`,
  { headers: { apikey: key, Authorization: `Bearer ${key}` } },
);

const body = await res.text();
console.log(`HTTP ${res.status}`);
console.log(body.slice(0, 300));

if (!res.ok) process.exit(1);

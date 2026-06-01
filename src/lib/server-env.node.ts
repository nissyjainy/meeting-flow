import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

let dotenvLoaded = false;

function parseEnvFile(contents: string): void {
  if (typeof process === "undefined" || !process.env) return;

  for (const line of contents.split("\n")) {
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

    if (key) {
      process.env[key] = value;
    }
  }
}

/** Load .env / .env.local into process.env (Node dev / SSR only). */
export function ensureServerEnvLoaded(): void {
  if (dotenvLoaded) return;
  dotenvLoaded = true;

  if (typeof process === "undefined" || !process.env) return;

  const root = process.cwd();
  for (const file of [".env", ".env.local"]) {
    const filePath = resolve(root, file);
    if (!existsSync(filePath)) continue;
    parseEnvFile(readFileSync(filePath, "utf8"));
  }
}

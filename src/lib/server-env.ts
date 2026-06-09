type EnvRecord = Record<string, string | undefined>;

export function sanitizeEnvValue(value: string | undefined): string | undefined {
  if (value == null) return undefined;

  let trimmed = String(value).trim();
  if (!trimmed || trimmed === "undefined" || trimmed === "null") return undefined;

  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    trimmed = trimmed.slice(1, -1).trim();
  }

  if (trimmed.toLowerCase().startsWith("bearer ")) {
    trimmed = trimmed.slice(7).trim();
  }

  return trimmed || undefined;
}

function readImportMetaEnv(key: string): string | undefined {
  try {
    const meta = import.meta.env as EnvRecord;
    return sanitizeEnvValue(meta[key]);
  } catch {
    return undefined;
  }
}

function readProcessEnv(key: string): string | undefined {
  try {
    if (typeof process === "undefined" || !process.env) return undefined;
    return sanitizeEnvValue(process.env[key]);
  } catch {
    return undefined;
  }
}

export function isValidResendApiKey(key: string | undefined): key is string {
  return Boolean(key && key.startsWith("re_") && key.length >= 12);
}

export type EnvResolution = {
  key: string;
  value: string | undefined;
  source: "import.meta.env" | "process.env" | "worker-env" | "none";
  valid: boolean;
};

const workerEnvCache: Record<string, string> = {};

type WorkersAiBinding = {
  run: (model: string, inputs: Record<string, unknown>) => Promise<unknown>;
};

let workersAiBinding: WorkersAiBinding | null = null;

/** Cloudflare bindings must be read by key; Object.entries(env) misses many secrets. */
const WORKER_ENV_ALLOWLIST = [
  "GROQ_API_KEY",
  "GROQ_WHISPER_MODEL",
  "GROQ_CHAT_MODEL",
  "EMBEDDING_MODEL",
  "CLOUDFLARE_ACCOUNT_ID",
  "CLOUDFLARE_API_TOKEN",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "GOOGLE_OAUTH_REDIRECT_URI",
  "RESEND_API_KEY",
  "CRON_SECRET",
  "SUPABASE_SERVICE_ROLE_KEY",
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_PUBLISHABLE_KEY",
  "APP_URL",
] as const;

const WORKER_ENV_ALLOWLIST_SET = new Set<string>(WORKER_ENV_ALLOWLIST);

function storeWorkerEnvValue(key: string, raw: unknown): void {
  const value = sanitizeEnvValue(typeof raw === "string" ? raw : undefined);
  if (!value) return;

  workerEnvCache[key] = value;
  if (typeof process !== "undefined" && process.env) {
    process.env[key] = value;
  }
}

function isClientPublicEnvKey(key: string): boolean {
  return key.startsWith("VITE_");
}

export function resolveServerEnv(key: string): EnvResolution {
  const fromWorker = sanitizeEnvValue(workerEnvCache[key]);
  if (fromWorker) {
    const valid = key !== "RESEND_API_KEY" || isValidResendApiKey(fromWorker);
    if (valid) {
      return { key, value: fromWorker, source: "worker-env", valid: true };
    }
  }

  const fromProcess = readProcessEnv(key);
  const fromMeta = isClientPublicEnvKey(key) ? readImportMetaEnv(key) : undefined;

  const candidates: Array<{ value: string | undefined; source: EnvResolution["source"] }> = [
    { value: fromProcess, source: "process.env" },
    { value: fromMeta, source: "import.meta.env" },
  ];

  if (key === "RESEND_API_KEY") {
    const valid = candidates.find((c) => isValidResendApiKey(c.value));
    if (valid?.value) {
      return { key, value: valid.value, source: valid.source, valid: true };
    }
    const first = candidates.find((c) => c.value);
    return {
      key,
      value: first?.value,
      source: first?.source ?? "none",
      valid: isValidResendApiKey(first?.value),
    };
  }

  const first = candidates.find((c) => c.value);
  return {
    key,
    value: first?.value,
    source: first?.source ?? "none",
    valid: Boolean(first?.value),
  };
}

export function readServerEnv(key: string): string | undefined {
  return resolveServerEnv(key).value;
}

export function maskSecret(value: string | undefined): string {
  if (!value) return "(not set)";
  if (value.length <= 8) return "***";
  return `${value.slice(0, 4)}…${value.slice(-4)}`;
}

export function getWorkersAiBinding(): WorkersAiBinding | null {
  return workersAiBinding;
}

export function bindWorkerEnv(env: unknown): void {
  if (!env || typeof env !== "object") return;

  const bindings = env as Record<string, unknown>;

  const ai = bindings.AI;
  if (ai && typeof ai === "object" && typeof (ai as WorkersAiBinding).run === "function") {
    workersAiBinding = ai as WorkersAiBinding;
  }

  for (const key of WORKER_ENV_ALLOWLIST) {
    const value = bindings[key];
    console.log("[env-debug]", key, typeof value === "string" ? "FOUND" : "MISSING");
    storeWorkerEnvValue(key, value);
  }

  for (const [key, value] of Object.entries(bindings)) {
    if (WORKER_ENV_ALLOWLIST_SET.has(key)) continue;
    storeWorkerEnvValue(key, value);
  }
}

export function getResendEnvDiagnostics(): Record<string, unknown> {
  const apiKeyResolved = resolveServerEnv("RESEND_API_KEY");
  const fromEmailResolved = resolveServerEnv("RESEND_FROM_EMAIL");

  return {
    resendApiKey: {
      resolved: maskSecret(apiKeyResolved.value),
      source: apiKeyResolved.source,
      validFormat: apiKeyResolved.valid,
      importMeta: maskSecret(readImportMetaEnv("RESEND_API_KEY")),
      processEnv: maskSecret(readProcessEnv("RESEND_API_KEY")),
      workerEnv: maskSecret(workerEnvCache.RESEND_API_KEY),
      length: apiKeyResolved.value?.length ?? 0,
    },
    resendFromEmail: {
      value: fromEmailResolved.value ?? "(not set)",
      source: fromEmailResolved.source,
    },
    dev: import.meta.env.DEV,
  };
}

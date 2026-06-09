import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSupabaseEnv } from "@/lib/supabase/env";

const CODE_TTL_MS = 60_000;

export type ExtensionAuthSessionPayload = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  email: string;
  userId: string;
};

export function isValidExtensionRedirectUri(redirectUri: string): boolean {
  try {
    const url = new URL(redirectUri);
    return url.protocol === "https:" && url.hostname.endsWith(".chromiumapp.org");
  } catch {
    return false;
  }
}

export async function createExtensionAuthCode(
  payload: ExtensionAuthSessionPayload,
): Promise<string> {
  const admin = getSupabaseAdminClient();
  if (!admin) {
    throw new Error("Extension auth is not configured on the server.");
  }

  const code = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + CODE_TTL_MS).toISOString();

  const { error } = await admin.from("extension_auth_codes").insert({
    code,
    user_id: payload.userId,
    email: payload.email,
    access_token: payload.accessToken,
    refresh_token: payload.refreshToken,
    session_expires_at: payload.expiresAt,
    expires_at: expiresAt,
  });

  if (error) {
    throw new Error(error.message);
  }

  return code;
}

export async function exchangeExtensionAuthCode(code: string): Promise<ExtensionAuthSessionPayload> {
  const admin = getSupabaseAdminClient();
  if (!admin) {
    throw new Error("Extension auth is not configured on the server.");
  }

  const trimmed = code?.trim();
  if (!trimmed) {
    throw new Error("Missing authorization code.");
  }

  const { data, error } = await admin
    .from("extension_auth_codes")
    .select("*")
    .eq("code", trimmed)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error("Invalid or expired authorization code.");
  }

  if (data.used_at) {
    throw new Error("Authorization code was already used.");
  }

  if (new Date(data.expires_at).getTime() < Date.now()) {
    throw new Error("Authorization code expired. Sign in again.");
  }

  const { error: updateError } = await admin
    .from("extension_auth_codes")
    .update({ used_at: new Date().toISOString() })
    .eq("code", trimmed)
    .is("used_at", null);

  if (updateError) {
    throw new Error(updateError.message);
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Number(data.session_expires_at),
    email: data.email,
    userId: data.user_id,
  };
}

export async function refreshExtensionAuthSession(
  refreshToken: string,
): Promise<ExtensionAuthSessionPayload> {
  const trimmed = refreshToken?.trim();
  if (!trimmed) {
    throw new Error("Missing refresh token.");
  }

  const { url, key } = getSupabaseEnv();
  const res = await fetch(`${url.replace(/\/$/, "")}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    headers: {
      apikey: key,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ refresh_token: trimmed }),
  });

  const body = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    user?: { id?: string; email?: string };
    error_description?: string;
    msg?: string;
  };

  if (!res.ok) {
    throw new Error(body.error_description || body.msg || "Session expired. Sign in again.");
  }

  if (!body.access_token) {
    throw new Error("Could not refresh session.");
  }

  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token ?? trimmed,
    expiresAt: Date.now() + (body.expires_in ?? 3600) * 1000,
    email: body.user?.email ?? "",
    userId: body.user?.id ?? "",
  };
}

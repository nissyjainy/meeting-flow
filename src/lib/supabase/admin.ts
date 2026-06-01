import { createClient } from "@supabase/supabase-js";
import { readServerEnv } from "@/lib/server-env";
import { getSupabaseEnv } from "./env";

export function getSupabaseAdminClient() {
  const serviceRoleKey = readServerEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (!serviceRoleKey) {
    return null;
  }

  const { url } = getSupabaseEnv();
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

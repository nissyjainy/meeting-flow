import { redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { AuthErrorResult, AuthSuccessResult, AuthUser } from "./types";

function toAuthUser(user: {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown>;
}): AuthUser {
  const metadata = user.user_metadata ?? {};
  const fullName =
    (typeof metadata.full_name === "string" && metadata.full_name) ||
    (typeof metadata.name === "string" && metadata.name) ||
    null;

  return {
    id: user.id,
    email: user.email ?? "",
    fullName,
  };
}

export const fetchUser = createServerFn({ method: "GET" }).handler(async (): Promise<AuthUser | null> => {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    return null;
  }

  return toAuthUser(data.user);
});

export const loginFn = createServerFn({ method: "POST" })
  .inputValidator((data: { email: string; password: string }) => data)
  .handler(async ({ data }): Promise<AuthErrorResult | AuthSuccessResult> => {
    const supabase = getSupabaseServerClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    });

    if (error) {
      return { error: true, message: error.message };
    }

    return { error: false };
  });

export const signupFn = createServerFn({ method: "POST" })
  .inputValidator((data: { email: string; password: string; fullName?: string }) => data)
  .handler(async ({ data }): Promise<AuthErrorResult | AuthSuccessResult> => {
    const supabase = getSupabaseServerClient();
    const { error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: data.fullName ? { full_name: data.fullName } : undefined,
      },
    });

    if (error) {
      return { error: true, message: error.message };
    }

    return { error: false };
  });

export const logoutFn = createServerFn({ method: "POST" }).handler(async () => {
  const supabase = getSupabaseServerClient();
  await supabase.auth.signOut();
  throw redirect({ to: "/login" });
});

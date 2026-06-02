import { createFileRoute, Link, redirect, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { loginFn, signupFn } from "@/lib/auth/server";
import { buildOAuthRedirectUrl, normalizeAuthRedirectPath } from "@/lib/auth/redirect-path";
import { createClient } from "@/lib/supabase/client";
import { pageTitle, PRODUCT_NAME } from "@/lib/branding";

type LoginSearch = {
  redirect?: string;
};

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>): LoginSearch => ({
    redirect: typeof search.redirect === "string" ? search.redirect : undefined,
  }),
  beforeLoad: ({ context, search }) => {
    if (context.user) {
      throw redirect({ to: normalizeAuthRedirectPath(search.redirect) });
    }
  },
  head: () => ({
    meta: [
      { title: pageTitle("Sign in") },
      { name: "description", content: `Sign in to your ${PRODUCT_NAME} workspace.` },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { redirect } = Route.useSearch();
  return <AuthShell mode="login" redirectTo={redirect} />;
}

export function AuthShell({
  mode,
  redirectTo,
}: {
  mode: "login" | "signup";
  redirectTo?: string;
}) {
  const isLogin = mode === "login";
  const router = useRouter();
  const login = useServerFn(loginFn);
  const signup = useServerFn(signupFn);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const authMutation = useMutation({
    mutationFn: async () => {
      if (isLogin) {
        return login({ data: { email, password } });
      }
      return signup({ data: { email, password, fullName: fullName || undefined } });
    },
    onSuccess: async (result) => {
      if (result.error) {
        toast.error(result.message);
        return;
      }
      await router.invalidate();
      await router.navigate({ to: normalizeAuthRedirectPath(redirectTo) });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Something went wrong");
    },
  });

  const handleGoogleSignIn = async () => {
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: buildOAuthRedirectUrl(window.location.origin, redirectTo),
      },
    });
    if (error) {
      toast.error(error.message);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    authMutation.mutate();
  };

  return (
    <motion.div className="grid min-h-screen grid-cols-1 lg:grid-cols-2">
      <motion.div className="hidden lg:block relative overflow-hidden bg-gradient-primary">
        <motion.div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,oklch(1_0_0/0.15),transparent_40%),radial-gradient(circle_at_80%_80%,oklch(1_0_0/0.12),transparent_45%)]" />
        <motion.div className="relative flex h-full flex-col justify-between p-12 text-primary-foreground">
          <motion.div className="flex items-center gap-2">
            <motion.div className="grid h-8 w-8 place-items-center rounded-lg bg-white/15 backdrop-blur">
              <Sparkles className="h-4 w-4" />
            </motion.div>
            <span className="text-sm font-semibold">{PRODUCT_NAME}</span>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <motion.div className="max-w-md text-3xl font-semibold leading-tight">
              The AI workspace that turns every meeting into momentum.
            </motion.div>
            <p className="mt-3 max-w-md text-sm text-primary-foreground/80">
              Auto-transcribe, summarize and extract action items — then watch them flow into your team's tasks in real time.
            </p>
            <motion.div className="mt-8 rounded-2xl border border-white/15 bg-white/10 p-5 backdrop-blur">
              <p className="text-sm italic">"We replaced three tools with {PRODUCT_NAME}. Our weekly syncs feel 2x faster."</p>
              <motion.div className="mt-3 text-xs opacity-80">— Maya L., Head of Operations at Linear</motion.div>
            </motion.div>
          </motion.div>
          <motion.div className="text-xs opacity-60">© 2026 {PRODUCT_NAME}</motion.div>
        </motion.div>
      </motion.div>

      <motion.div className="flex items-center justify-center bg-background p-6">
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm">
          <Card className="p-8 shadow-card">
            <motion.div className="mb-6 lg:hidden flex items-center gap-2">
              <motion.div className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-primary">
                <Sparkles className="h-3.5 w-3.5 text-primary-foreground" />
              </motion.div>
              <span className="text-sm font-semibold">{PRODUCT_NAME}</span>
            </motion.div>
            <h1 className="text-xl font-semibold tracking-tight">
              {isLogin ? "Welcome back" : "Create your account"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {isLogin ? "Sign in to your workspace to continue." : "Start your free 14-day trial. No card required."}
            </p>

            <motion.div className="mt-6 space-y-2">
              <Button
                type="button"
                variant="outline"
                className="w-full justify-center gap-2"
                onClick={handleGoogleSignIn}
                disabled={authMutation.isPending}
              >
                <GoogleIcon /> Continue with Google
              </Button>
            </motion.div>

            <motion.div className="my-5 flex items-center gap-3 text-[11px] uppercase tracking-wide text-muted-foreground">
              <span className="h-px flex-1 bg-border" /> or {isLogin ? "sign in" : "sign up"} with email{" "}
              <span className="h-px flex-1 bg-border" />
            </motion.div>

            <form className="space-y-3" onSubmit={handleSubmit}>
              {!isLogin && (
                <motion.div>
                  <Label htmlFor="fullName" className="text-xs">
                    Full name
                  </Label>
                  <Input
                    id="fullName"
                    placeholder="Daniel Park"
                    className="mt-1.5"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    autoComplete="name"
                  />
                </motion.div>
              )}
              <motion.div>
                <Label htmlFor="email" className="text-xs">
                  Work email
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@company.com"
                  className="mt-1.5"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </motion.div>
              <motion.div>
                <Label htmlFor="password" className="text-xs">
                  Password
                </Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  className="mt-1.5"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  autoComplete={isLogin ? "current-password" : "new-password"}
                />
              </motion.div>
              <Button
                type="submit"
                className="w-full bg-gradient-primary text-primary-foreground hover:opacity-90"
                disabled={authMutation.isPending}
              >
                {authMutation.isPending ? "Please wait…" : isLogin ? "Sign in" : "Create account"}
              </Button>
            </form>

            <p className="mt-5 text-center text-xs text-muted-foreground">
              {isLogin ? (
                <>
                  Don't have an account?{" "}
                  <Link
                    to="/signup"
                    search={redirectTo ? { redirect: redirectTo } : undefined}
                    className="text-primary hover:underline"
                  >
                    Sign up
                  </Link>
                </>
              ) : (
                <>
                  Already have an account?{" "}
                  <Link
                    to="/login"
                    search={redirectTo ? { redirect: redirectTo } : undefined}
                    className="text-primary hover:underline"
                  >
                    Sign in
                  </Link>
                </>
              )}
            </p>
          </Card>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}

function GoogleIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.43.34-2.09V7.07H2.18A11 11 0 0 0 1 12c0 1.78.43 3.47 1.18 4.93l3.66-2.84z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.07.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"
      />
    </svg>
  );
}

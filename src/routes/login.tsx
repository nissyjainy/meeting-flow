import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in — Northstar" },
      { name: "description", content: "Sign in to your Northstar Meeting Intelligence workspace." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  return <AuthShell mode="login" />;
}

export function AuthShell({ mode }: { mode: "login" | "signup" }) {
  const isLogin = mode === "login";
  return (
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-2">
      <div className="hidden lg:block relative overflow-hidden bg-gradient-primary">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,oklch(1_0_0/0.15),transparent_40%),radial-gradient(circle_at_80%_80%,oklch(1_0_0/0.12),transparent_45%)]" />
        <div className="relative flex h-full flex-col justify-between p-12 text-primary-foreground">
          <div className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-white/15 backdrop-blur">
              <Sparkles className="h-4 w-4" />
            </div>
            <span className="text-sm font-semibold">Northstar</span>
          </div>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <div className="max-w-md text-3xl font-semibold leading-tight">
              The AI workspace that turns every meeting into momentum.
            </div>
            <p className="mt-3 max-w-md text-sm text-primary-foreground/80">
              Auto-transcribe, summarize and extract action items — then watch them flow into your team's tasks in real time.
            </p>
            <div className="mt-8 rounded-2xl border border-white/15 bg-white/10 p-5 backdrop-blur">
              <p className="text-sm italic">"We replaced three tools with Northstar. Our weekly syncs feel 2x faster."</p>
              <div className="mt-3 text-xs opacity-80">— Maya L., Head of Operations at Linear</div>
            </div>
          </motion.div>
          <div className="text-xs opacity-60">© 2026 Northstar Labs</div>
        </div>
      </div>

      <div className="flex items-center justify-center bg-background p-6">
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm">
          <Card className="p-8 shadow-card">
            <div className="mb-6 lg:hidden flex items-center gap-2">
              <div className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-primary">
                <Sparkles className="h-3.5 w-3.5 text-primary-foreground" />
              </div>
              <span className="text-sm font-semibold">Northstar</span>
            </div>
            <h1 className="text-xl font-semibold tracking-tight">
              {isLogin ? "Welcome back" : "Create your account"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {isLogin ? "Sign in to your workspace to continue." : "Start your free 14-day trial. No card required."}
            </p>

            <div className="mt-6 space-y-2">
              <Button variant="outline" className="w-full justify-center gap-2">
                <GoogleIcon /> Continue with Google
              </Button>
              <Button variant="outline" className="w-full justify-center gap-2">
                <span className="text-base"></span> Continue with SSO
              </Button>
            </div>

            <div className="my-5 flex items-center gap-3 text-[11px] uppercase tracking-wide text-muted-foreground">
              <span className="h-px flex-1 bg-border" /> or {isLogin ? "sign in" : "sign up"} with email <span className="h-px flex-1 bg-border" />
            </div>

            <form className="space-y-3">
              {!isLogin && (
                <div>
                  <Label className="text-xs">Full name</Label>
                  <Input placeholder="Daniel Park" className="mt-1.5" />
                </div>
              )}
              <div>
                <Label className="text-xs">Work email</Label>
                <Input type="email" placeholder="you@company.com" className="mt-1.5" />
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Password</Label>
                  {isLogin && <a className="text-[11px] text-primary hover:underline" href="#">Forgot?</a>}
                </div>
                <Input type="password" placeholder="••••••••" className="mt-1.5" />
              </div>
              <Button className="w-full bg-gradient-primary text-primary-foreground hover:opacity-90" asChild>
                <Link to="/">{isLogin ? "Sign in" : "Create account"}</Link>
              </Button>
            </form>

            <p className="mt-5 text-center text-xs text-muted-foreground">
              {isLogin ? (
                <>Don't have an account? <Link to="/signup" className="text-primary hover:underline">Sign up</Link></>
              ) : (
                <>Already have an account? <Link to="/login" className="text-primary hover:underline">Sign in</Link></>
              )}
            </p>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.43.34-2.09V7.07H2.18A11 11 0 0 0 1 12c0 1.78.43 3.47 1.18 4.93l3.66-2.84z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.07.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/>
    </svg>
  );
}
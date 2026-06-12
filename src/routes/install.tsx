import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  Bot,
  Download,
  FileText,
  FolderOpen,
  ListChecks,
  Mic,
  PackageOpen,
  Puzzle,
  Sparkles,
  ToggleRight,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { pageTitle, PRODUCT_NAME, PRODUCT_TAGLINE } from "@/lib/branding";
import { EXTENSION_LATEST_RELEASE_URL } from "@/lib/extension/install";
import { cn } from "@/lib/utils";

const INSTALL_STEPS = [
  { step: 1, title: "Download the ZIP", icon: Download },
  { step: 2, title: "Extract the ZIP", icon: PackageOpen },
  { step: 3, title: "Open chrome://extensions", icon: Puzzle },
  { step: 4, title: "Enable Developer Mode", icon: ToggleRight },
  { step: 5, title: "Click Load Unpacked", icon: FolderOpen },
  { step: 6, title: "Select the extension folder", icon: Sparkles },
] as const;

const FEATURE_CARDS: Array<{
  title: string;
  description: string;
  icon: LucideIcon;
}> = [
  {
    title: "AI Transcription",
    description: "Turn meeting audio into searchable transcripts with Groq-powered speech recognition.",
    icon: Mic,
  },
  {
    title: "Meeting Summaries",
    description: "Get concise AI summaries so your team can catch up in minutes, not hours.",
    icon: FileText,
  },
  {
    title: "Action Items",
    description: "Automatically extract tasks, owners, and deadlines from every conversation.",
    icon: ListChecks,
  },
  {
    title: "AI Assistant",
    description: "Ask questions across all your meetings — decisions, owners, and follow-ups.",
    icon: Bot,
  },
];

export const Route = createFileRoute("/install")({
  head: () => ({
    meta: [
      { title: pageTitle("Install Extension") },
      {
        name: "description",
        content: `Install the ${PRODUCT_NAME} Chrome extension to capture Google Meet, Zoom, and Teams meetings.`,
      },
    ],
  }),
  component: InstallPage,
});

function InstallPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_15%_0%,oklch(0.56_0.21_270/0.12),transparent_45%),radial-gradient(circle_at_85%_100%,oklch(0.72_0.18_295/0.1),transparent_50%)]" />

      <header className="relative border-b border-border/60 bg-background/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-primary shadow-elegant">
              <Sparkles className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="text-sm font-semibold tracking-tight">{PRODUCT_NAME}</span>
          </Link>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/login">Sign in</Link>
            </Button>
            <Button size="sm" className="bg-gradient-primary text-primary-foreground hover:opacity-90" asChild>
              <a href={EXTENSION_LATEST_RELEASE_URL} target="_blank" rel="noopener noreferrer">
                Download
              </a>
            </Button>
          </div>
        </div>
      </header>

      <main className="relative mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14 lg:py-16">
        <motion.section
          className="text-center"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-border/80 bg-card/60 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
            <Puzzle className="h-3.5 w-3.5 text-primary" />
            Chrome extension · Manifest V3
          </div>
          <h1 className="mt-5 text-3xl font-semibold tracking-tight sm:text-4xl lg:text-5xl">
            Install MeetFlow Extension
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base text-muted-foreground sm:text-lg">
            Capture meetings from Google Meet, Zoom, and Teams.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button
              size="lg"
              className="h-11 min-w-[12rem] bg-gradient-primary text-primary-foreground shadow-elegant hover:opacity-90"
              asChild
            >
              <a href={EXTENSION_LATEST_RELEASE_URL} target="_blank" rel="noopener noreferrer">
                <Download className="mr-2 h-4 w-4" />
                Download Extension
              </a>
            </Button>
            <p className="text-xs text-muted-foreground sm:max-w-xs">
              Opens the latest release on GitHub. Download the ZIP asset, then follow the steps below.
            </p>
          </div>
        </motion.section>

        <section className="mt-12 sm:mt-16">
          <div className="mb-6 text-center sm:mb-8">
            <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">Installation guide</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Load the extension locally in Chrome — no Web Store required for development.
            </p>
          </div>

          <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {INSTALL_STEPS.map((item, index) => (
              <motion.li
                key={item.step}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05, duration: 0.35 }}
              >
                <Card className="flex gap-4 p-4 shadow-card transition-shadow hover:shadow-elegant sm:p-5">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                    <item.icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      Step {item.step}
                    </p>
                    <p className="mt-1 text-sm font-medium leading-snug sm:text-base">{item.title}</p>
                  </div>
                </Card>
              </motion.li>
            ))}
          </ol>
        </section>

        <section className="mt-12 sm:mt-16">
          <div className="mb-6 text-center sm:mb-8">
            <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">What you get with MeetFlow</h2>
            <p className="mt-2 text-sm text-muted-foreground">{PRODUCT_TAGLINE}</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {FEATURE_CARDS.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 + index * 0.06, duration: 0.35 }}
              >
                <Card className="h-full p-5 shadow-card transition-shadow hover:shadow-elegant sm:p-6">
                  <div className="flex items-start gap-4">
                    <div
                      className={cn(
                        "grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-primary text-primary-foreground shadow-elegant",
                      )}
                    >
                      <feature.icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-base font-semibold tracking-tight">{feature.title}</h3>
                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                        {feature.description}
                      </p>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        </section>

        <section className="mt-12 text-center sm:mt-16">
          <Card className="mx-auto max-w-2xl border-border/80 bg-card/60 p-6 shadow-card backdrop-blur sm:p-8">
            <h2 className="text-lg font-semibold tracking-tight">Ready to capture your next meeting?</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              After installing the extension, sign in with your MeetFlow account to upload captures for transcription
              and AI insights.
            </p>
            <div className="mt-5 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button className="bg-gradient-primary text-primary-foreground hover:opacity-90" asChild>
                <Link to="/login">Sign in to MeetFlow</Link>
              </Button>
              <Button variant="outline" asChild>
                <a href={EXTENSION_LATEST_RELEASE_URL} target="_blank" rel="noopener noreferrer">
                  Download Extension
                </a>
              </Button>
            </div>
          </Card>
        </section>
      </main>

      <footer className="relative border-t border-border/60 py-6 text-center text-xs text-muted-foreground">
        © 2026 {PRODUCT_NAME}
      </footer>
    </div>
  );
}

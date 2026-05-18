import { createFileRoute } from "@tanstack/react-router";
import { AuthShell } from "./login";

export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [
      { title: "Create account — Northstar" },
      { name: "description", content: "Start your free Northstar trial — AI meeting intelligence for modern teams." },
    ],
  }),
  component: () => <AuthShell mode="signup" />,
});
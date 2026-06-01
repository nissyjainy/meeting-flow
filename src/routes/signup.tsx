import { createFileRoute, redirect } from "@tanstack/react-router";
import { AuthShell } from "./login";

type SignupSearch = {
  redirect?: string;
};

export const Route = createFileRoute("/signup")({
  validateSearch: (search: Record<string, unknown>): SignupSearch => ({
    redirect: typeof search.redirect === "string" ? search.redirect : undefined,
  }),
  beforeLoad: ({ context, search }) => {
    if (context.user) {
      throw redirect({ href: search.redirect ?? "/" });
    }
  },
  head: () => ({
    meta: [
      { title: "Create account — Northstar" },
      { name: "description", content: "Start your free Northstar trial — AI meeting intelligence for modern teams." },
    ],
  }),
  component: SignupPage,
});

function SignupPage() {
  const { redirect } = Route.useSearch();
  return <AuthShell mode="signup" redirectTo={redirect} />;
}

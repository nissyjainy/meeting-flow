import { createFileRoute, redirect } from "@tanstack/react-router";
import { AuthShell } from "./login";
import { pageTitle, PRODUCT_NAME, PRODUCT_TAGLINE } from "@/lib/branding";

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
      { title: pageTitle("Create account") },
      { name: "description", content: `Start your free ${PRODUCT_NAME} trial — ${PRODUCT_TAGLINE}.` },
    ],
  }),
  component: SignupPage,
});

function SignupPage() {
  const { redirect } = Route.useSearch();
  return <AuthShell mode="signup" redirectTo={redirect} />;
}

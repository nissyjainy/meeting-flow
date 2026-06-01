import { createFileRoute } from "@tanstack/react-router";
import { logoutFn } from "@/lib/auth/server";

export const Route = createFileRoute("/logout")({
  preload: false,
  loader: () => logoutFn(),
});

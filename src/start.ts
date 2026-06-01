import { createStart, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";
import { getSupabaseServerClient } from "./lib/supabase/server";
import { validateServerStartupEnv } from "./lib/startup-env-validation";

let appBootLogged = false;

const supabaseMiddleware = createMiddleware().server(async ({ next }) => {
  if (!appBootLogged) {
    appBootLogged = true;
    console.log("[app-boot] TanStack Start server middleware active");
    validateServerStartupEnv("start-middleware");
    try {
      const { logReminderEnvStatus } = await import("./lib/reminders/reminder-env");
      logReminderEnvStatus("start-middleware");
    } catch (error) {
      console.error("[app-boot] reminder env log skipped (server-only)", error);
    }
  }
  const supabase = getSupabaseServerClient();
  await supabase.auth.getUser();
  return next();
});

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

export const startInstance = createStart(() => ({
  requestMiddleware: [errorMiddleware, supabaseMiddleware],
}));

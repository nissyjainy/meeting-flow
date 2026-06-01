import {
  getResendEnvDiagnostics,
  maskSecret,
  readServerEnv,
  resolveServerEnv,
} from "@/lib/server-env";
import { reminderLog } from "./reminder-debug";

export function getReminderConfig() {
  const apiKeyResolution = resolveServerEnv("RESEND_API_KEY");
  const fromEmailResolution = resolveServerEnv("RESEND_FROM_EMAIL");

  const resendApiKey = apiKeyResolution.value;
  const fromEmail = fromEmailResolution.value ?? "onboarding@resend.dev";
  const appUrl = (readServerEnv("APP_URL") ?? readServerEnv("VITE_APP_URL") ?? "http://localhost:8080").replace(
    /\/$/,
    "",
  );
  const upcomingDays = Number.parseInt(readServerEnv("REMINDER_UPCOMING_DAYS") ?? "7", 10);
  const cronSecret = readServerEnv("CRON_SECRET");
  const fallbackTo = readServerEnv("REMINDER_EMAIL_TO");

  return {
    resendApiKey,
    fromEmail,
    appUrl,
    upcomingDays: Number.isFinite(upcomingDays) && upcomingDays > 0 ? upcomingDays : 7,
    cronSecret,
    fallbackTo,
    enabled: Boolean(apiKeyResolution.valid && fromEmail),
    apiKeySource: apiKeyResolution.source,
  };
}

export function logReminderEnvStatus(context: string): void {
  const config = getReminderConfig();
  const diagnostics = getResendEnvDiagnostics();

  reminderLog("env variable check", {
    context,
    RESEND_API_KEY: diagnostics.resendApiKey,
    RESEND_FROM_EMAIL: diagnostics.resendFromEmail,
    detected: config.enabled,
    apiKeySource: config.apiKeySource,
  });

  if (!config.resendApiKey) {
    reminderLog("env variable missing — RESEND_API_KEY", { context });
  } else if (!config.enabled) {
    reminderLog("env variable invalid — RESEND_API_KEY format must start with re_", {
      context,
      masked: maskSecret(config.resendApiKey),
      source: config.apiKeySource,
    });
  } else {
    reminderLog("env variable detected — RESEND_API_KEY", {
      context,
      masked: maskSecret(config.resendApiKey),
      source: config.apiKeySource,
      length: config.resendApiKey.length,
    });
  }

  if (!config.fromEmail) {
    reminderLog("env variable missing — RESEND_FROM_EMAIL", { context });
  }
}

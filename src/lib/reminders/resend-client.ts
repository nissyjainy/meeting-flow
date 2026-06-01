import {
  getResendEnvDiagnostics,
  isValidResendApiKey,
  maskSecret,
  resolveServerEnv,
} from "@/lib/server-env";
import { reminderError, reminderLog } from "./reminder-debug";
import { getReminderConfig } from "./reminder-env";
import type { ReminderEmailOutcome } from "./task-reminder-types";

type ResendSendResponse = {
  id?: string;
  message?: string;
  name?: string;
  statusCode?: number;
};

function resolveResendApiKeyForSend(): { apiKey: string | undefined; source: string; valid: boolean } {
  const resolution = resolveServerEnv("RESEND_API_KEY");
  return {
    apiKey: resolution.value,
    source: resolution.source,
    valid: resolution.valid,
  };
}

export async function sendReminderEmail(params: {
  to: string;
  subject: string;
  html: string;
  text: string;
  meetingId?: string | null;
}): Promise<ReminderEmailOutcome> {
  reminderLog("resend client initialization started");
  logResendEnvDiagnostics("sendReminderEmail");

  const config = getReminderConfig();
  const keyResolution = resolveResendApiKeyForSend();

  if (!keyResolution.apiKey || !isValidResendApiKey(keyResolution.apiKey)) {
    reminderLog("resend client not initialized — invalid or missing API key", {
      source: keyResolution.source,
      masked: maskSecret(keyResolution.apiKey),
      diagnostics: getResendEnvDiagnostics().resendApiKey,
    });
    return {
      success: false,
      sent: false,
      error:
        "RESEND_API_KEY is missing or invalid in server env. Expected format: re_xxxx. Restart npm run dev after updating .env.local.",
    };
  }

  if (!config.fromEmail) {
    reminderLog("resend client not initialized — missing RESEND_FROM_EMAIL");
    return {
      success: false,
      sent: false,
      error: "RESEND_FROM_EMAIL is missing in server env.",
    };
  }

  reminderLog("resend client initialized", {
    apiKeySource: keyResolution.source,
    apiKeyMasked: maskSecret(keyResolution.apiKey),
    apiKeyLength: keyResolution.apiKey.length,
    fromEmail: config.fromEmail,
  });

  reminderLog("resend sending reminder email", {
    to: params.to,
    subject: params.subject,
    htmlLength: params.html.length,
    textLength: params.text.length,
    includesV2Marker: params.html.includes("reminder-template-v2"),
    includesTaskCards: params.html.includes("reminder-task-card"),
  });

  const payload = {
    from: config.fromEmail,
    to: [params.to],
    subject: params.subject,
    html: params.html,
    text: params.text,
  };

  reminderLog("email payload generated", {
    to: params.to,
    from: config.fromEmail,
    subject: params.subject,
    htmlLength: params.html.length,
    textLength: params.text.length,
  });

  reminderLog("resend request started", {
    to: params.to,
    endpoint: "https://api.resend.com/emails",
    authorizationPrefix: `Bearer ${keyResolution.apiKey.slice(0, 7)}…`,
  });

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${keyResolution.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const responseText = await response.text();
    let parsed: ResendSendResponse | null = null;
    try {
      parsed = responseText ? (JSON.parse(responseText) as ResendSendResponse) : null;
    } catch {
      parsed = null;
    }

    reminderLog("resend API response", {
      httpStatus: response.status,
      ok: response.ok,
      messageId: parsed?.id ?? null,
      errorMessage: parsed?.message ?? parsed?.name ?? null,
      bodyPreview: responseText.slice(0, 500),
    });

    if (!response.ok) {
      const message =
        parsed?.message ?? parsed?.name ?? responseText.slice(0, 500) ?? `HTTP ${response.status}`;
      reminderError("resend response failure", new Error(message), {
        to: params.to,
        httpStatus: response.status,
        apiKeySource: keyResolution.source,
        apiKeyValid: isValidResendApiKey(keyResolution.apiKey),
        bodyPreview: responseText.slice(0, 800),
      });
      return { success: false, sent: false, error: message };
    }

    reminderLog("resend response success", {
      to: params.to,
      httpStatus: response.status,
      messageId: parsed?.id ?? null,
    });

    try {
      const { recordReminderSend } = await import("./record-reminder-send.server");
      await recordReminderSend({
        meetingId: params.meetingId,
        recipient: params.to,
        subject: params.subject,
      });
    } catch (recordError) {
      reminderLog("reminder send record failed (non-fatal)", {
        to: params.to,
        error: recordError instanceof Error ? recordError.message : String(recordError),
      });
    }

    return { success: true, sent: true, messageId: parsed?.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to send reminder email";
    reminderError("resend request failed (exception)", error, {
      to: params.to,
      apiKeySource: keyResolution.source,
    });
    return { success: false, sent: false, error: message };
  }
}

function logResendEnvDiagnostics(context: string): void {
  const diagnostics = getResendEnvDiagnostics();
  reminderLog("resend env diagnostics", { context, ...diagnostics });
}

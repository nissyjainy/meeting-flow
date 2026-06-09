const GROQ_TRANSCRIPTION_ENDPOINT = "https://api.groq.com/openai/v1/audio/transcriptions";
const GROQ_MODELS_ENDPOINT = "https://api.groq.com/openai/v1/models";

export const GROQ_WHISPER_MODEL_FALLBACKS = [
  "whisper-large-v3-turbo",
  "whisper-large-v3",
] as const;

export type GroqTranscriptionMode = "signed_url" | "file_upload";

export type GroqTranscriptionRequest = {
  apiKey: string;
  model: string;
  signedAudioUrl?: string | null;
  fileBlob?: Blob | null;
  fileName?: string | null;
  mimeType?: string | null;
};

export type GroqTranscriptionResult = {
  text: string;
  model: string;
  mode: GroqTranscriptionMode;
  httpStatus: number;
};

export function isValidGroqApiKey(key: string | undefined): boolean {
  return Boolean(key && key.startsWith("gsk_") && key.length >= 20);
}

function concatUint8Arrays(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }
  return merged;
}

function buildTextMultipartBody(
  fields: Record<string, string>,
  boundary = `----MeetFlowGroq${crypto.randomUUID().replace(/-/g, "")}`,
): { body: Uint8Array; contentType: string } {
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];

  for (const [name, value] of Object.entries(fields)) {
    chunks.push(
      encoder.encode(
        `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`,
      ),
    );
  }

  chunks.push(encoder.encode(`--${boundary}--\r\n`));

  return {
    body: concatUint8Arrays(chunks),
    contentType: `multipart/form-data; boundary=${boundary}`,
  };
}

async function buildFileMultipartBody(
  fields: Record<string, string>,
  file: { blob: Blob; name: string; mime: string },
): Promise<{ body: Uint8Array; contentType: string }> {
  const boundary = `----MeetFlowGroq${crypto.randomUUID().replace(/-/g, "")}`;
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];

  for (const [name, value] of Object.entries(fields)) {
    chunks.push(
      encoder.encode(
        `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`,
      ),
    );
  }

  chunks.push(
    encoder.encode(
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${file.name}"\r\nContent-Type: ${file.mime}\r\n\r\n`,
    ),
  );
  chunks.push(new Uint8Array(await file.blob.arrayBuffer()));
  chunks.push(encoder.encode(`\r\n--${boundary}--\r\n`));

  return {
    body: concatUint8Arrays(chunks),
    contentType: `multipart/form-data; boundary=${boundary}`,
  };
}

async function postGroqTranscription(
  apiKey: string,
  body: Uint8Array,
  contentType: string,
): Promise<{ ok: boolean; status: number; body: string }> {
  const response = await fetch(GROQ_TRANSCRIPTION_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": contentType,
    },
    body,
  });

  const responseBody = await response.text().catch(() => "");
  return { ok: response.ok, status: response.status, body: responseBody };
}

export async function probeGroqApiKey(apiKey: string): Promise<{
  ok: boolean;
  httpStatus: number;
  bodyPreview: string;
}> {
  const response = await fetch(GROQ_MODELS_ENDPOINT, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  const body = await response.text().catch(() => "");
  return {
    ok: response.ok,
    httpStatus: response.status,
    bodyPreview: body.slice(0, 300),
  };
}

export async function transcribeAudioWithGroq(
  request: GroqTranscriptionRequest,
): Promise<GroqTranscriptionResult> {
  if (!isValidGroqApiKey(request.apiKey)) {
    throw new Error(
      "GROQ_API_KEY is missing or malformed. Set a Groq key (starts with gsk_) in Worker secrets.",
    );
  }

  const modelsToTry = [
    request.model?.trim(),
    ...GROQ_WHISPER_MODEL_FALLBACKS,
  ].filter((model, index, list) => model && list.indexOf(model) === index) as string[];

  const attempts: Array<{
    model: string;
    mode: GroqTranscriptionMode;
    status: number;
    body: string;
  }> = [];

  for (const model of modelsToTry) {
    if (request.signedAudioUrl?.trim()) {
      const fields = {
        model,
        url: request.signedAudioUrl.trim(),
        response_format: "json",
      };
      const multipart = buildTextMultipartBody(fields);
      const result = await postGroqTranscription(request.apiKey, multipart.body, multipart.contentType);
      attempts.push({
        model,
        mode: "signed_url",
        status: result.status,
        body: result.body,
      });

      if (result.ok) {
        const json = JSON.parse(result.body) as { text?: string };
        const text = (json.text ?? "").trim();
        if (!text) {
          throw new Error("Groq transcription returned empty text.");
        }
        return {
          text,
          model,
          mode: "signed_url",
          httpStatus: result.status,
        };
      }

      if (result.status === 401 || result.status === 403) {
        break;
      }
    }

    if (request.fileBlob && request.fileName) {
      const mime = request.mimeType?.trim() || request.fileBlob.type || "application/octet-stream";
      const multipart = await buildFileMultipartBody(
        { model, response_format: "json" },
        { blob: request.fileBlob, name: request.fileName, mime },
      );
      const result = await postGroqTranscription(request.apiKey, multipart.body, multipart.contentType);
      attempts.push({
        model,
        mode: "file_upload",
        status: result.status,
        body: result.body,
      });

      if (result.ok) {
        const json = JSON.parse(result.body) as { text?: string };
        const text = (json.text ?? "").trim();
        if (!text) {
          throw new Error("Groq transcription returned empty text.");
        }
        return {
          text,
          model,
          mode: "file_upload",
          httpStatus: result.status,
        };
      }

      if (result.status === 401 || result.status === 403) {
        break;
      }
    }
  }

  const last = attempts.at(-1);
  const detail = last?.body ? last.body : "no Groq response body";
  const modes = attempts.map((a) => `${a.mode}:${a.model}:${a.status}`).join(", ");
  throw new Error(
    `Groq transcription failed (HTTP ${last?.status ?? "unknown"})${detail ? `: ${detail}` : ""} [attempts=${modes}]`,
  );
}

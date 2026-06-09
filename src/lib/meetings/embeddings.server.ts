import {
  getWorkersAiBinding,
  readServerEnv,
} from "@/lib/server-env";

/** Workers AI BGE base model — 768 dimensions (matches meeting_chunks.embedding). */
export const EMBEDDING_MODEL_DEFAULT = "@cf/baai/bge-base-en-v1.5";
export const EMBEDDING_DIMENSIONS = 768;

const CLOUDFLARE_AI_RUN_BASE = "https://api.cloudflare.com/client/v4";

type WorkersAiRunResult = { data?: number[][] } | number[][];

function getEmbeddingModel(): string {
  return readServerEnv("EMBEDDING_MODEL")?.trim() || EMBEDDING_MODEL_DEFAULT;
}

function extractVectors(result: WorkersAiRunResult, expectedCount: number): number[][] {
  const data = Array.isArray(result) ? result : result.data;
  if (!data?.length) {
    throw new Error("Embedding model returned empty data.");
  }
  if (data.length !== expectedCount) {
    throw new Error(
      `Embedding count mismatch (expected ${expectedCount}, got ${data.length}).`,
    );
  }

  return data.map((embedding, index) => {
    if (!embedding?.length) {
      throw new Error(`Empty embedding at index ${index}.`);
    }
    if (embedding.length !== EMBEDDING_DIMENSIONS) {
      throw new Error(
        `Unexpected embedding dimension ${embedding.length} (expected ${EMBEDDING_DIMENSIONS}).`,
      );
    }
    return embedding;
  });
}

async function generateEmbeddingsViaWorkersAi(
  texts: string[],
  model: string,
): Promise<number[][]> {
  const binding = getWorkersAiBinding();
  if (!binding) {
    throw new Error("Workers AI binding is not available.");
  }

  const result = (await binding.run(model, { text: texts })) as WorkersAiRunResult;
  return extractVectors(result, texts.length);
}

async function generateEmbeddingsViaCloudflareRest(
  texts: string[],
  model: string,
): Promise<number[][]> {
  const accountId = readServerEnv("CLOUDFLARE_ACCOUNT_ID");
  const apiToken = readServerEnv("CLOUDFLARE_API_TOKEN");
  if (!accountId || !apiToken) {
    throw new Error(
      "Missing CLOUDFLARE_ACCOUNT_ID or CLOUDFLARE_API_TOKEN for embedding generation.",
    );
  }

  const res = await fetch(
    `${CLOUDFLARE_AI_RUN_BASE}/accounts/${accountId}/ai/run/${model}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text: texts }),
    },
  );

  const bodyText = await res.text();
  if (!res.ok) {
    throw new Error(
      `Cloudflare Workers AI failed (HTTP ${res.status})${bodyText ? `: ${bodyText}` : ""}`,
    );
  }

  let json: { success?: boolean; result?: WorkersAiRunResult; errors?: unknown };
  try {
    json = JSON.parse(bodyText) as {
      success?: boolean;
      result?: WorkersAiRunResult;
      errors?: unknown;
    };
  } catch {
    throw new Error("Cloudflare Workers AI returned non-JSON response.");
  }

  if (!json.success || !json.result) {
    throw new Error(
      `Cloudflare Workers AI error: ${JSON.stringify(json.errors ?? json)}`,
    );
  }

  return extractVectors(json.result, texts.length);
}

export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const inputs = texts.map((t) => t.trim()).filter(Boolean);
  if (inputs.length === 0) return [];

  const model = getEmbeddingModel();

  if (getWorkersAiBinding()) {
    return generateEmbeddingsViaWorkersAi(inputs, model);
  }

  return generateEmbeddingsViaCloudflareRest(inputs, model);
}

export async function generateQueryEmbedding(query: string): Promise<number[]> {
  const [embedding] = await generateEmbeddings([query]);
  if (!embedding) {
    throw new Error("Query embedding generation returned empty result.");
  }
  return embedding;
}

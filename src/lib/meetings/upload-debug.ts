const PREFIX = "[meeting-upload]";

export function uploadDebug(step: string, detail?: Record<string, unknown>): void {
  if (detail !== undefined) {
    console.log(PREFIX, step, detail);
    return;
  }
  console.log(PREFIX, step);
}

export function uploadDebugError(step: string, error: unknown, detail?: Record<string, unknown>): void {
  const err =
    error instanceof Error
      ? { name: error.name, message: error.message, stack: error.stack }
      : { raw: error };

  console.error(PREFIX, step, { ...detail, error: err });
}

export function uploadDebugReturn<T>(
  step: string,
  value: T,
  detail?: Record<string, unknown>,
): T {
  uploadDebug(`${step} → return`, { ...detail, value });
  return value;
}

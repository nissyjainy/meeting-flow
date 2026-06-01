const PREFIX = "[meeting-tasks]";

export function taskLog(step: string, detail?: Record<string, unknown>): void {
  if (detail !== undefined) {
    console.log(PREFIX, step, detail);
    return;
  }
  console.log(PREFIX, step);
}

export function taskError(step: string, error: unknown, detail?: Record<string, unknown>): void {
  const err =
    error instanceof Error
      ? { name: error.name, message: error.message, stack: error.stack }
      : { raw: error };

  console.error(PREFIX, step, { ...detail, error: err });
}

export function taskPreview(text: string, max = 400): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}… [truncated ${text.length - max} chars]`;
}

const PREFIX = "[meeting-transcription]";

export function transcriptionLog(step: string, detail?: Record<string, unknown>): void {
  if (detail !== undefined) {
    console.log(PREFIX, step, detail);
    return;
  }
  console.log(PREFIX, step);
}

export function transcriptionError(
  step: string,
  error: unknown,
  detail?: Record<string, unknown>,
): void {
  const err =
    error instanceof Error
      ? { name: error.name, message: error.message, stack: error.stack }
      : { raw: error };

  console.error(PREFIX, step, { ...detail, error: err });
}

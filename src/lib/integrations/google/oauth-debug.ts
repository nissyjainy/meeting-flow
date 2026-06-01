const PREFIX = "[google-oauth]";

export function googleOAuthDebug(step: string, detail?: Record<string, unknown>): void {
  if (detail !== undefined) {
    console.log(PREFIX, step, detail);
    return;
  }
  console.log(PREFIX, step);
}

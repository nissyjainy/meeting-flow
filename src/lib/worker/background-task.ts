type WaitUntilContext = {
  waitUntil: (promise: Promise<unknown>) => void;
};

let waitUntilFn: ((promise: Promise<unknown>) => void) | null = null;

export function bindWorkerExecutionContext(ctx: unknown): void {
  if (
    ctx &&
    typeof ctx === "object" &&
    "waitUntil" in ctx &&
    typeof (ctx as WaitUntilContext).waitUntil === "function"
  ) {
    waitUntilFn = (ctx as WaitUntilContext).waitUntil.bind(ctx);
    return;
  }
  waitUntilFn = null;
}

export function resetWorkerExecutionContext(): void {
  waitUntilFn = null;
}

/** Returns true when running inside a Cloudflare Worker with waitUntil available. */
export function hasWorkerWaitUntil(): boolean {
  return waitUntilFn != null;
}

/**
 * Schedule work that must continue after the HTTP response is sent.
 * On Cloudflare Workers this uses ctx.waitUntil(); locally it falls back to awaiting.
 */
export async function scheduleBackgroundTask(
  label: string,
  task: () => Promise<void>,
): Promise<void> {
  const run = async () => {
    console.info(`[background-task] start ${label}`);
    try {
      await task();
      console.info(`[background-task] done ${label}`);
    } catch (error) {
      console.error(`[background-task] failed ${label}`, error);
      throw error;
    }
  };

  const promise = run();

  if (waitUntilFn) {
    waitUntilFn(promise);
    return;
  }

  await promise;
}

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  bindWorkerExecutionContext,
  hasWorkerWaitUntil,
  resetWorkerExecutionContext,
  scheduleBackgroundTask,
} from "./background-task";

describe("scheduleBackgroundTask", () => {
  afterEach(() => {
    resetWorkerExecutionContext();
  });

  it("awaits locally when waitUntil is unavailable", async () => {
    const task = vi.fn(async () => {});
    await scheduleBackgroundTask("test", task);
    expect(task).toHaveBeenCalledOnce();
    expect(hasWorkerWaitUntil()).toBe(false);
  });

  it("uses waitUntil on Cloudflare execution context", async () => {
    const waitUntil = vi.fn();
    bindWorkerExecutionContext({ waitUntil });

    let resolveTask!: () => void;
    const taskPromise = new Promise<void>((resolve) => {
      resolveTask = resolve;
    });
    const task = vi.fn(() => taskPromise);

    await scheduleBackgroundTask("worker-test", task);
    expect(task).toHaveBeenCalledOnce();
    expect(waitUntil).toHaveBeenCalledOnce();
    expect(hasWorkerWaitUntil()).toBe(true);

    resolveTask();
    await taskPromise;
  });
});

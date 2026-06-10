import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";

type RecordingFinalizeModule = {
  MIN_RECORDING_BYTES: number;
  CAPTURE_STATUS: {
    MEETING_ENDED_UNEXPECTEDLY: string;
    SAVING_RECORDING: string;
    UPLOADING: string;
    PARTIAL_CAPTURE_UPLOADED: string;
    PARTIAL_CAPTURE_TOO_SHORT: string;
  };
  FINALIZE_REASON: { MANUAL: string; ABRUPT: string };
  shouldAttemptFinalize: (chunks: unknown[]) => boolean;
  isBlobTooSmall: (blobSize: number) => boolean;
  getTooSmallMessage: (reason: string, blobSize: number) => string;
  buildFinalizeDiagnostics: (
    mixDiagnostics: Record<string, unknown> | null,
    blob: Blob,
    chunkCount: number,
    reason: string,
  ) => Record<string, unknown>;
  formatRecordingListStatus: (uploadStatus: string | undefined) => string;
  attachTrackEndedHandlers: (
    stream: { getTracks: () => Array<{ kind: string; fireEnded: () => void }> },
    onTrackEnded: (track: { kind: string }) => void,
  ) => void;
  planFinalizeOutcome: (input: {
    reason: string;
    chunkCount: number;
    blobSize: number;
  }) => { action: string; ok: boolean; message?: string };
  abruptStatusProgression: () => string[];
};

function loadRecordingFinalize(): RecordingFinalizeModule {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../extension");
  const code = readFileSync(path.join(root, "recording-finalize.js"), "utf8");
  const sandbox: { globalThis: Record<string, unknown> } = { globalThis: {} };
  runInNewContext(code, sandbox);
  return sandbox.globalThis.MeetFlowRecordingFinalize as RecordingFinalizeModule;
}

function createMockTrack(kind: string) {
  let endedHandler: (() => void) | undefined;
  return {
    kind,
    addEventListener(event: string, handler: () => void, _options?: { once?: boolean }) {
      if (event === "ended") {
        endedHandler = handler;
      }
    },
    fireEnded() {
      endedHandler?.();
    },
  };
}

describe("recording-finalize helpers", () => {
  const finalize = loadRecordingFinalize();

  it("plans partial upload when host ends meeting with enough chunks", () => {
    const outcome = finalize.planFinalizeOutcome({
      reason: finalize.FINALIZE_REASON.ABRUPT,
      chunkCount: 12,
      blobSize: finalize.MIN_RECORDING_BYTES + 500,
    });

    expect(outcome).toEqual({ action: "partial_upload", ok: true });
  });

  it("plans partial too short for abrupt termination with tiny blob", () => {
    const outcome = finalize.planFinalizeOutcome({
      reason: finalize.FINALIZE_REASON.ABRUPT,
      chunkCount: 2,
      blobSize: 1200,
    });

    expect(outcome.ok).toBe(false);
    expect(outcome.action).toBe("partial_too_short");
    expect(outcome.message).toBe(finalize.CAPTURE_STATUS.PARTIAL_CAPTURE_TOO_SHORT);
  });

  it("finalizes when recorder is inactive but chunks exist", () => {
    expect(finalize.shouldAttemptFinalize([new Blob(["chunk"])])).toBe(true);

    const outcome = finalize.planFinalizeOutcome({
      reason: finalize.FINALIZE_REASON.MANUAL,
      chunkCount: 3,
      blobSize: 20_000,
    });

    expect(outcome).toEqual({ action: "upload", ok: true });
  });

  it("does not finalize when there are no chunks", () => {
    expect(finalize.shouldAttemptFinalize([])).toBe(false);
    expect(
      finalize.planFinalizeOutcome({
        reason: finalize.FINALIZE_REASON.ABRUPT,
        chunkCount: 0,
        blobSize: 0,
      }),
    ).toEqual({ action: "none", ok: false });
  });

  it("attaches track ended handlers for tab capture streams", () => {
    const onTrackEnded = vi.fn();
    const track = createMockTrack("audio");
    const stream = { getTracks: () => [track] };

    finalize.attachTrackEndedHandlers(stream, onTrackEnded);
    track.fireEnded();
    expect(onTrackEnded).toHaveBeenCalledWith(track);
  });

  it("defines abrupt status progression for UI flow", () => {
    expect(finalize.abruptStatusProgression()).toEqual([
      finalize.CAPTURE_STATUS.MEETING_ENDED_UNEXPECTEDLY,
      finalize.CAPTURE_STATUS.SAVING_RECORDING,
      finalize.CAPTURE_STATUS.UPLOADING,
      finalize.CAPTURE_STATUS.PARTIAL_CAPTURE_UPLOADED,
    ]);
  });

  it("formats partial upload status for recent captures", () => {
    expect(finalize.formatRecordingListStatus("partial")).toBe(
      finalize.CAPTURE_STATUS.PARTIAL_CAPTURE_UPLOADED,
    );
  });

  it("builds finalize diagnostics with abrupt reason", () => {
    const blob = new Blob([new Uint8Array(finalize.MIN_RECORDING_BYTES)], {
      type: "video/webm",
    });
    const diagnostics = finalize.buildFinalizeDiagnostics(
      { tabAudioTrackCount: 1 },
      blob,
      4,
      finalize.FINALIZE_REASON.ABRUPT,
    );

    expect(diagnostics.finalizeReason).toBe("abrupt");
    expect(diagnostics.chunkCount).toBe(4);
    expect(diagnostics.blobSize).toBe(blob.size);
  });
});

import { describe, expect, it } from "vitest";

type MockTrack = { id: string; kind: "audio" | "video" };

type MockStream = {
  getAudioTracks: () => MockTrack[];
  getVideoTracks: () => MockTrack[];
  getTracks: () => MockTrack[];
};

function countStreamTracks(stream: MockStream) {
  return {
    audioTrackCount: stream.getAudioTracks().length,
    videoTrackCount: stream.getVideoTracks().length,
    trackCount: stream.getTracks().length,
  };
}

function buildMixedRecordingStream(tabStream: MockStream, mixedAudioStream: MockStream) {
  const tabCounts = countStreamTracks(tabStream);
  const mixedCounts = countStreamTracks(mixedAudioStream);

  if (tabCounts.audioTrackCount === 0) {
    throw new Error("No audio track in tab capture.");
  }
  if (mixedCounts.audioTrackCount === 0) {
    throw new Error("No mixed audio track from AudioContext destination.");
  }

  const tracks = [...tabStream.getVideoTracks(), ...mixedAudioStream.getAudioTracks()];

  return {
    tracks,
    tabAudioTrackCount: tabCounts.audioTrackCount,
    tabVideoTrackCount: tabCounts.videoTrackCount,
    mixedAudioTrackCount: mixedCounts.audioTrackCount,
    mixedTrackCount: tracks.length,
  };
}

function buildMixDiagnostics({
  tabStream,
  micStream,
  mixedAudioStream,
  recordingStream,
  recordingMode,
}: {
  tabStream: MockStream;
  micStream: MockStream;
  mixedAudioStream: MockStream;
  recordingStream: MockStream;
  recordingMode: string;
}) {
  const tabCounts = countStreamTracks(tabStream);
  const micCounts = countStreamTracks(micStream);
  const mixedCounts = countStreamTracks(mixedAudioStream);
  const recordingCounts = countStreamTracks(recordingStream);

  return {
    tabAudioTrackCount: tabCounts.audioTrackCount,
    tabVideoTrackCount: tabCounts.videoTrackCount,
    micTrackCount: micCounts.audioTrackCount,
    mixedAudioTrackCount: mixedCounts.audioTrackCount,
    mixedTrackCount: recordingCounts.trackCount,
    audioTrackCount: mixedCounts.audioTrackCount,
    videoTrackCount: recordingCounts.videoTrackCount,
    recordingMode,
  };
}

function track(kind: "audio" | "video", id: string): MockTrack {
  return { id, kind };
}

function mockStream(audio: MockTrack[], video: MockTrack[] = []): MockStream {
  const tracks = [...audio, ...video];
  return {
    getAudioTracks: () => audio,
    getVideoTracks: () => video,
    getTracks: () => tracks,
  };
}

describe("extension audio mix helpers", () => {
  it("combines tab video with mixed audio tracks for recording", () => {
    const tab = mockStream([track("audio", "tab-a1")], [track("video", "tab-v1")]);
    const mixed = mockStream([track("audio", "mix-a1")]);

    const result = buildMixedRecordingStream(tab, mixed);

    expect(result.tabAudioTrackCount).toBe(1);
    expect(result.tabVideoTrackCount).toBe(1);
    expect(result.mixedAudioTrackCount).toBe(1);
    expect(result.mixedTrackCount).toBe(2);
    expect(result.tracks.map((t) => t.id)).toEqual(["tab-v1", "mix-a1"]);
  });

  it("reports tab, mic, and mixed diagnostics", () => {
    const tab = mockStream([track("audio", "tab-a1")], [track("video", "tab-v1")]);
    const mic = mockStream([track("audio", "mic-a1")]);
    const mixed = mockStream([track("audio", "mix-a1")]);
    const recording = mockStream([track("audio", "mix-a1")], [track("video", "tab-v1")]);

    const diagnostics = buildMixDiagnostics({
      tabStream: tab,
      micStream: mic,
      mixedAudioStream: mixed,
      recordingStream: recording,
      recordingMode: "video+audio-mixed",
    });

    expect(diagnostics).toEqual({
      tabAudioTrackCount: 1,
      tabVideoTrackCount: 1,
      micTrackCount: 1,
      mixedAudioTrackCount: 1,
      mixedTrackCount: 2,
      audioTrackCount: 1,
      videoTrackCount: 1,
      recordingMode: "video+audio-mixed",
    });
  });

  it("requires tab audio before mixing", () => {
    const tab = mockStream([], [track("video", "tab-v1")]);
    const mixed = mockStream([track("audio", "mix-a1")]);

    expect(() => buildMixedRecordingStream(tab, mixed)).toThrow("No audio track in tab capture.");
  });
});

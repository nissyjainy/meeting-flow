/** Helpers for tab + microphone mixed recording in the offscreen document. */

function countStreamTracks(stream) {
  return {
    audioTrackCount: stream.getAudioTracks().length,
    videoTrackCount: stream.getVideoTracks().length,
    trackCount: stream.getTracks().length,
  };
}

function buildMixedRecordingStream(tabStream, mixedAudioStream) {
  const tabCounts = countStreamTracks(tabStream);
  const mixedCounts = countStreamTracks(mixedAudioStream);

  if (tabCounts.audioTrackCount === 0) {
    throw new Error("No audio track in tab capture.");
  }
  if (mixedCounts.audioTrackCount === 0) {
    throw new Error("No mixed audio track from AudioContext destination.");
  }

  const videoTracks = tabStream.getVideoTracks();
  const audioTracks = mixedAudioStream.getAudioTracks();
  const recordingStream = new MediaStream([...videoTracks, ...audioTracks]);

  return {
    recordingStream,
    tabAudioTrackCount: tabCounts.audioTrackCount,
    tabVideoTrackCount: tabCounts.videoTrackCount,
    mixedAudioTrackCount: mixedCounts.audioTrackCount,
    mixedTrackCount: recordingStream.getTracks().length,
  };
}

function selectRecorderMimeType(recordingStream) {
  const videoTracks = recordingStream.getVideoTracks();

  if (videoTracks.length > 0) {
    const candidates = [
      "video/webm;codecs=vp8,opus",
      "video/webm;codecs=vp9,opus",
      "video/webm",
    ];
    for (const mimeType of candidates) {
      if (MediaRecorder.isTypeSupported(mimeType)) {
        return { mimeType, mode: "video+audio-mixed" };
      }
    }
  }

  const audioCandidates = ["audio/webm;codecs=opus", "audio/webm"];
  const audioOnly = new MediaStream(recordingStream.getAudioTracks());
  for (const mimeType of audioCandidates) {
    if (MediaRecorder.isTypeSupported(mimeType)) {
      return { stream: audioOnly, mimeType, mode: "audio-only-mixed" };
    }
  }

  return {
    stream: new MediaStream(recordingStream.getAudioTracks()),
    mimeType: "audio/webm",
    mode: "audio-only-mixed",
  };
}

function buildMixDiagnostics({ tabStream, micStream, mixedAudioStream, recordingStream, recordingMode }) {
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

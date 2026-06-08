/** Binary helpers for extension upload paths (popup/background/offscreen). */

function toUint8Array(value) {
  if (value instanceof Uint8Array) {
    return value;
  }
  if (value instanceof ArrayBuffer) {
    return new Uint8Array(value);
  }
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  }
  throw new Error(
    `Expected binary data (ArrayBuffer/Uint8Array), received ${Object.prototype.toString.call(value)}.`,
  );
}

function hasWebmEbmlHeader(bytes) {
  return (
    bytes.length >= 4 &&
    bytes[0] === 0x1a &&
    bytes[1] === 0x45 &&
    bytes[2] === 0xdf &&
    bytes[3] === 0xa3
  );
}

async function readBlobHeader(blob, length = 4) {
  const slice = blob.slice(0, length);
  return toUint8Array(await slice.arrayBuffer());
}

async function validateWebmBlob(blob, expectedBytes) {
  if (!(blob instanceof Blob) || blob.size === 0) {
    throw new Error("Recording blob is empty.");
  }

  if (expectedBytes != null && blob.size !== expectedBytes) {
    throw new Error(`Recording blob size mismatch (${blob.size} vs ${expectedBytes}).`);
  }

  const header = await readBlobHeader(blob);
  if (!hasWebmEbmlHeader(header)) {
    const preview = Array.from(header).map((byte) => byte.toString(16).padStart(2, "0")).join(" ");
    throw new Error(`Invalid WebM header before upload (first bytes: ${preview}).`);
  }

  return { bytes: blob.size, header };
}

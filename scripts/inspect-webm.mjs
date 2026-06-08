import { readFileSync, writeFileSync, existsSync } from "node:fs";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const path = process.env.FILE_PATH;

if (!url || !key || !path) {
  console.error("Set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, FILE_PATH");
  process.exit(1);
}

const signedRes = await fetch(`${url}/storage/v1/object/sign/meetings/${encodeURI(path)}`, {
  method: "POST",
  headers: {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ expiresIn: 300 }),
});

const signedBody = await signedRes.json();
if (!signedRes.ok) {
  console.error("sign failed", signedBody);
  process.exit(1);
}

const signedUrl = signedBody.signedURL.startsWith("http")
  ? signedBody.signedURL
  : `${url.replace(/\/$/, "")}/storage/v1${signedBody.signedURL}`;
const fileRes = await fetch(signedUrl);
const buf = Buffer.from(await fileRes.arrayBuffer());
const out = "tmp-inspect.webm";
writeFileSync(out, buf);

function parseEbmlTracks(buffer) {
  const text = buffer.toString("latin1");
  const hasOpus = text.includes("Opus") || text.includes("opus");
  const hasVorbis = text.includes("Vorbis");
  const hasVp8 = text.includes("V_VP8") || text.includes("vp8");
  const hasVp9 = text.includes("V_VP9") || text.includes("vp9");
  const hasAudioTrack = text.includes("A_OPUS") || text.includes("A_VORBIS") || hasOpus;
  const hasVideoTrack = text.includes("V_VP8") || text.includes("V_VP9") || hasVp8 || hasVp9;
  return { hasOpus, hasVorbis, hasVp8, hasVp9, hasAudioTrack, hasVideoTrack };
}

const tracks = parseEbmlTracks(buf);
console.log(
  JSON.stringify(
    {
      bytes: buf.length,
      httpStatus: fileRes.status,
      contentType: fileRes.headers.get("content-type"),
      webmSignature: buf.slice(0, 4).toString("hex"),
      tracks,
    },
    null,
    2,
  ),
);

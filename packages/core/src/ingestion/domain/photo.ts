import { err, ok, type Result } from "../../shared/index.js";

export type ImageType = "jpeg" | "png" | "webp" | "gif" | "unknown";

// The Claude API caps an image at 10 MB of base64, which is 4/3 of the raw
// size: 7,500,000 raw bytes is exactly 10,000,000 base64 characters.
export const MAX_PAGE_BYTES = 7_500_000;

function startsWith(bytes: Uint8Array, signature: number[], offset = 0): boolean {
  return bytes.length >= offset + signature.length && signature.every((value, i) => bytes[offset + i] === value);
}

const ascii = (text: string) => Array.from(text, (char) => char.charCodeAt(0));

// Read from the bytes themselves, never from the file name or the MIME
// type the client announced.
export function sniffImageType(bytes: Uint8Array): ImageType {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "jpeg";
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "png";
  if (startsWith(bytes, ascii("RIFF")) && startsWith(bytes, ascii("WEBP"), 8)) return "webp";
  if (startsWith(bytes, ascii("GIF8"))) return "gif";
  return "unknown";
}

// JPEG only: the browser always re-encodes before upload, so anything else
// did not come from the app. An empty file never sniffs as a JPEG.
export function isAcceptable(bytes: Uint8Array): boolean {
  return bytes.length <= MAX_PAGE_BYTES && sniffImageType(bytes) === "jpeg";
}

const SOI = 0xd8;
const SOS = 0xda;
const COM = 0xfe;
const isAppSegment = (marker: number) => marker >= 0xe0 && marker <= 0xef;

// Drops every APPn segment (JFIF, EXIF with its GPS block, XMP, ICC,
// IPTC...) and every comment, keeps the segments needed to decode the image
// byte for byte, and copies everything from SOS onward untouched: the
// entropy-coded data is never parsed (docs/securite.md, "Données non
// conservées"). Orientation lived in EXIF too; the browser has already
// applied it when re-encoding.
export function stripJpegMetadata(bytes: Uint8Array): Result<Uint8Array, "malformed-jpeg"> {
  if (bytes[0] !== 0xff || bytes[1] !== SOI) return err("malformed-jpeg");

  const kept: Uint8Array[] = [bytes.subarray(0, 2)];
  let offset = 2;
  while (offset < bytes.length) {
    if (bytes[offset] !== 0xff) return err("malformed-jpeg");
    // Any number of 0xFF fill bytes may precede a marker.
    while (bytes[offset] === 0xff) offset++;
    const marker = bytes[offset];
    if (marker === undefined) return err("malformed-jpeg");
    const markerStart = offset - 1;

    const high = bytes[offset + 1];
    const low = bytes[offset + 2];
    if (high === undefined || low === undefined) return err("malformed-jpeg");
    const segmentEnd = offset + 1 + ((high << 8) | low);
    if (segmentEnd > bytes.length) return err("malformed-jpeg");

    if (marker === SOS) {
      kept.push(bytes.subarray(markerStart));
      return ok(concat(kept));
    }
    if (!isAppSegment(marker) && marker !== COM) kept.push(bytes.subarray(markerStart, segmentEnd));
    offset = segmentEnd;
  }
  return err("malformed-jpeg");
}

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let position = 0;
  for (const part of parts) {
    out.set(part, position);
    position += part.length;
  }
  return out;
}

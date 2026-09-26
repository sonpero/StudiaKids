import path from "node:path";

// Formats a phone writes with its EXIF by construction: never a fixture.
const RAW_FORMATS = new Set([".heic", ".heif", ".tif", ".tiff", ".dng", ".avif"]);

const text = (bytes: Uint8Array, start: number, length: number) => String.fromCharCode(...bytes.subarray(start, start + length));

// APP1..APP15 carry EXIF (GPS included), XMP, IPTC...; COM is free text.
// APP0 (JFIF) holds no personal information.
function jpegProblem(bytes: Uint8Array): string | null {
  let offset = 2;
  while (offset + 3 < bytes.length && bytes[offset] === 0xff) {
    const marker = bytes[offset + 1] ?? 0;
    if (marker === 0xda || marker === 0xd9) return null;
    if (marker >= 0xe1 && marker <= 0xef) {
      const kind = marker === 0xe1 && text(bytes, offset + 4, 4) === "Exif" ? "EXIF" : `APP${String(marker - 0xe0)}`;
      return `JPEG metadata segment (${kind})`;
    }
    if (marker === 0xfe) return "JPEG comment segment (COM)";
    offset += 2 + (((bytes[offset + 2] ?? 0) << 8) | (bytes[offset + 3] ?? 0));
  }
  return null;
}

function pngProblem(bytes: Uint8Array): string | null {
  let offset = 8;
  while (offset + 8 <= bytes.length) {
    const length = (((bytes[offset] ?? 0) << 24) >>> 0) + ((bytes[offset + 1] ?? 0) << 16) + ((bytes[offset + 2] ?? 0) << 8) + (bytes[offset + 3] ?? 0);
    const type = text(bytes, offset + 4, 4);
    if (["eXIf", "tEXt", "zTXt", "iTXt"].includes(type)) return `PNG metadata chunk (${type})`;
    offset += 12 + length;
  }
  return null;
}

function webpProblem(bytes: Uint8Array): string | null {
  const body = text(bytes, 12, bytes.length - 12);
  return body.includes("EXIF") || body.includes("XMP ") ? "WebP metadata chunk" : null;
}

// Why an image may not sit in the (public) repository, or null. The
// extension is read case-insensitively: IMG_6371.JPG is a JPEG too.
export function imageMetadataProblem(file: string, bytes: Uint8Array): string | null {
  const extension = path.extname(file).toLowerCase();
  if (RAW_FORMATS.has(extension)) return `raw phone format (${extension})`;
  if (extension === ".jpg" || extension === ".jpeg") return jpegProblem(bytes);
  if (extension === ".png") return pngProblem(bytes);
  if (extension === ".webp") return webpProblem(bytes);
  return null;
}

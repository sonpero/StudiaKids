import { describe, expect, it } from "vitest";
import { isAcceptable, MAX_PAGE_BYTES, sniffImageType, stripJpegMetadata } from "./photo.js";

const bytes = (...values: number[]) => Uint8Array.from(values);
const ascii = (text: string) => Array.from(text, (char) => char.charCodeAt(0));

// A JPEG segment: marker, then a big-endian length that counts itself.
function segment(marker: number, payload: number[]): number[] {
  const length = payload.length + 2;
  return [0xff, marker, length >> 8, length & 0xff, ...payload];
}

const SOI = [0xff, 0xd8];
const EOI = [0xff, 0xd9];
const APP0_JFIF = segment(0xe0, [...ascii("JFIF"), 0, 1, 1, 0, 0, 1, 0, 1, 0, 0]);
const APP1_EXIF_GPS = segment(0xe1, [...ascii("Exif"), 0, 0, ...ascii("GPS 48.8566N 2.3522E")]);
const APP13_IPTC = segment(0xed, ascii("Photoshop 3.0 IPTC"));
const APP15 = segment(0xef, ascii("vendor"));
const COM = segment(0xfe, ascii("shot on a phone"));
const DQT = segment(0xdb, [0, ...Array.from({ length: 64 }, (_, i) => i + 1)]);
const SOF0 = segment(0xc0, [8, 0, 16, 0, 16, 1, 1, 0x11, 0]);
// Entropy-coded data may contain 0xFF 0x00 stuffing and restart markers:
// everything after SOS must be copied untouched, never parsed as segments.
const SOS_AND_SCAN = [...segment(0xda, [1, 1, 0, 0, 63, 0]), 0x12, 0xff, 0x00, 0x34, 0xff, 0xd0, 0x56, 0xe1, 0xfe];

const jpegWithMetadata = bytes(...SOI, ...APP0_JFIF, ...APP1_EXIF_GPS, ...APP13_IPTC, ...APP15, ...COM, ...DQT, ...SOF0, ...SOS_AND_SCAN, ...EOI);
const sameJpegWithoutMetadata = bytes(...SOI, ...DQT, ...SOF0, ...SOS_AND_SCAN, ...EOI);

describe("sniffImageType", () => {
  it("recognises a JPEG from its first bytes", () => {
    expect(sniffImageType(jpegWithMetadata)).toBe("jpeg");
  });

  it("recognises a PNG, even if it was uploaded as photo.jpg", () => {
    expect(sniffImageType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0))).toBe("png");
  });

  it("recognises a WebP (RIFF....WEBP)", () => {
    expect(sniffImageType(bytes(...ascii("RIFF"), 1, 2, 3, 4, ...ascii("WEBP"), 0))).toBe("webp");
  });

  it("does not mistake another RIFF container (a WAV sound) for a WebP", () => {
    expect(sniffImageType(bytes(...ascii("RIFF"), 1, 2, 3, 4, ...ascii("WAVE"), 0))).toBe("unknown");
  });

  it("recognises a GIF", () => {
    expect(sniffImageType(bytes(...ascii("GIF89a"), 0, 0))).toBe("gif");
  });

  it("returns unknown for anything else, including too few bytes to tell", () => {
    expect(sniffImageType(bytes(...ascii("%PDF-1.7")))).toBe("unknown");
    expect(sniffImageType(bytes(0xff, 0xd8))).toBe("unknown");
    expect(sniffImageType(bytes())).toBe("unknown");
  });
});

describe("isAcceptable", () => {
  const jpegOfSize = (size: number) => {
    const photo = new Uint8Array(size);
    photo.set([0xff, 0xd8, 0xff]);
    return photo;
  };

  it("is exactly 7,500,000 bytes: 10,000,000 base64 characters, the API's per-image cap", () => {
    expect(MAX_PAGE_BYTES).toBe(7_500_000);
    expect(Math.ceil(MAX_PAGE_BYTES / 3) * 4).toBe(10_000_000);
  });

  it("accepts a real JPEG up to and including the limit", () => {
    expect(isAcceptable(jpegOfSize(1024))).toBe(true);
    expect(isAcceptable(jpegOfSize(MAX_PAGE_BYTES))).toBe(true);
  });

  it("rejects a JPEG one byte over the limit", () => {
    expect(isAcceptable(jpegOfSize(MAX_PAGE_BYTES + 1))).toBe(false);
  });

  it("rejects PNG, WebP and anything that is not really a JPEG, whatever it was called", () => {
    expect(isAcceptable(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe(false);
    expect(isAcceptable(bytes(...ascii("RIFF"), 1, 2, 3, 4, ...ascii("WEBP")))).toBe(false);
    expect(isAcceptable(bytes(...ascii("not a photo")))).toBe(false);
  });

  it("rejects an empty file", () => {
    expect(isAcceptable(bytes())).toBe(false);
  });
});

describe("stripJpegMetadata", () => {
  it("removes every metadata segment (APP1 to APP15, COM) and keeps the image segments byte for byte", () => {
    const result = stripJpegMetadata(jpegWithMetadata);

    expect(result).toEqual({ ok: true, value: sameJpegWithoutMetadata });
  });

  it("leaves no trace of the GPS coordinates", () => {
    const result = stripJpegMetadata(jpegWithMetadata);
    if (!result.ok) throw new Error("expected ok");

    expect(Buffer.from(result.value).toString("latin1")).not.toContain("GPS");
  });

  it("also drops APP0: nothing before the image data is needed to decode it", () => {
    const result = stripJpegMetadata(bytes(...SOI, ...APP0_JFIF, ...DQT, ...SOF0, ...SOS_AND_SCAN, ...EOI));

    expect(result).toEqual({ ok: true, value: sameJpegWithoutMetadata });
  });

  it("skips 0xFF fill bytes before a marker", () => {
    const withFill = bytes(...SOI, 0xff, 0xff, ...APP1_EXIF_GPS, 0xff, ...DQT, ...SOF0, ...SOS_AND_SCAN, ...EOI);

    expect(stripJpegMetadata(withFill)).toEqual({ ok: true, value: sameJpegWithoutMetadata });
  });

  it("rejects a scan header (SOS) cut short by the end of the file", () => {
    expect(stripJpegMetadata(bytes(...SOI, ...DQT, 0xff, 0xda, 0x00, 0x0c, 1, 1))).toEqual({ ok: false, error: "malformed-jpeg" });
  });

  it("is idempotent", () => {
    expect(stripJpegMetadata(sameJpegWithoutMetadata)).toEqual({ ok: true, value: sameJpegWithoutMetadata });
  });

  it("rejects a file that does not start with SOI", () => {
    expect(stripJpegMetadata(bytes(0x89, 0x50, 0x4e, 0x47))).toEqual({ ok: false, error: "malformed-jpeg" });
  });

  it("rejects a segment whose declared length runs past the end of the file", () => {
    expect(stripJpegMetadata(bytes(...SOI, 0xff, 0xe1, 0x40, 0x00, 1, 2, 3))).toEqual({ ok: false, error: "malformed-jpeg" });
  });

  it("rejects a file that ends before any image data (no SOS)", () => {
    expect(stripJpegMetadata(bytes(...SOI, ...APP1_EXIF_GPS))).toEqual({ ok: false, error: "malformed-jpeg" });
  });
});

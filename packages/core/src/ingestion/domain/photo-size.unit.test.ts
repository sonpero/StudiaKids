import { describe, expect, it } from "vitest";
import { jpegSize } from "./photo.js";

const segment = (marker: number, payload: number[]) => [0xff, marker, (payload.length + 2) >> 8, (payload.length + 2) & 0xff, ...payload];

// Read from the frame header: what the fixture adapter matches photos on,
// since the browser's canvas re-encoding changes every byte but keeps the
// size of a photo already at native size.
describe("jpegSize", () => {
  it("reads width and height from the baseline frame header, past any other segment", () => {
    const jpeg = Uint8Array.from([0xff, 0xd8, ...segment(0xe1, [1, 2, 3]), ...segment(0xc0, [8, 0x06, 0x7b, 0x08, 0xa4, 3]), 0xff, 0xd9]);

    expect(jpegSize(jpeg)).toEqual({ width: 2212, height: 1659 });
  });

  it("reads progressive JPEGs too (SOF2)", () => {
    expect(jpegSize(Uint8Array.from([0xff, 0xd8, ...segment(0xc2, [8, 0, 10, 0, 20, 3])]))).toEqual({ width: 20, height: 10 });
  });

  it("does not mistake a Huffman table (0xC4) for a frame header", () => {
    const jpeg = Uint8Array.from([0xff, 0xd8, ...segment(0xc4, [0, 9, 9, 9, 9]), ...segment(0xc0, [8, 0, 7, 0, 5, 3])]);

    expect(jpegSize(jpeg)).toEqual({ width: 5, height: 7 });
  });

  it("returns null without a frame header, before the scan, or on a broken segment", () => {
    expect(jpegSize(Uint8Array.from([0xff, 0xd8, ...segment(0xdb, [0])]))).toBeNull();
    expect(jpegSize(Uint8Array.from([0xff, 0xd8, ...segment(0xda, [0]), ...segment(0xc0, [8, 0, 7, 0, 5, 3])]))).toBeNull();
    expect(jpegSize(Uint8Array.from([0xff, 0xd8, 0x00, 0xc0, 0, 8, 8, 0, 7, 0, 5, 3]))).toBeNull();
  });
});

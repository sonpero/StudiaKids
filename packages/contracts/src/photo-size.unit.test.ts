import { describe, expect, it } from "vitest";
import { nativePhotoSize, PHOTO_MAX_EDGE_PX, PHOTO_MAX_VISUAL_TOKENS } from "./photo-size.js";

const visualTokens = (w: number, h: number) => Math.ceil(w / 28) * Math.ceil(h / 28);
const STANDARD_TIER = { maxEdge: 1568, maxVisualTokens: 1568 };

describe("photo size limits", () => {
  it("match the high-resolution tier (Claude 4.7 and later, claude-sonnet-5 included)", () => {
    expect(PHOTO_MAX_EDGE_PX).toBe(2576);
    expect(PHOTO_MAX_VISUAL_TOKENS).toBe(4784);
  });
});

// Expected values come from Anthropic's vision docs ("Resolution and token
// cost" table, and the reference implementation's worked example).
describe("nativePhotoSize", () => {
  it("leaves an image that already fits untouched", () => {
    expect(nativePhotoSize(1920, 1080)).toEqual({ width: 1920, height: 1080 });
    expect(nativePhotoSize(1000, 1000)).toEqual({ width: 1000, height: 1000 });
  });

  it("shrinks a 4K landscape image to the documented high-resolution size", () => {
    expect(nativePhotoSize(3840, 2160)).toEqual({ width: 2576, height: 1449 });
  });

  it("handles portrait images the same way, axes swapped", () => {
    expect(nativePhotoSize(2160, 3840)).toEqual({ width: 1449, height: 2576 });
  });

  it("reproduces the documented standard-tier examples when given those limits", () => {
    expect(nativePhotoSize(1075, 1520, STANDARD_TIER)).toEqual({ width: 924, height: 1307 });
    expect(nativePhotoSize(1920, 1080, STANDARD_TIER)).toEqual({ width: 1456, height: 819 });
  });

  // A 12 MP phone photo (4:3): the visual-token budget binds long before
  // the edge limit does, which is why an edge-only constant would be wrong.
  it("for a 4:3 phone photo, returns the largest size within the token budget", () => {
    const { width, height } = nativePhotoSize(4032, 3024);

    expect(width).toBeLessThan(PHOTO_MAX_EDGE_PX);
    expect(visualTokens(width, height)).toBeLessThanOrEqual(PHOTO_MAX_VISUAL_TOKENS);
    expect(Math.abs(width / height - 4 / 3)).toBeLessThan(0.002);
    const oneBigger = width + 1;
    expect(visualTokens(oneBigger, Math.round(oneBigger * 0.75))).toBeGreaterThan(PHOTO_MAX_VISUAL_TOKENS);
  });
});

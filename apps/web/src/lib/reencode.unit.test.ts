// @vitest-environment jsdom
import { nativePhotoSize } from "@studiakids/contracts";
import { afterEach, describe, expect, it, vi } from "vitest";
import { JPEG_QUALITY, reencodePhoto } from "./reencode.js";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// jsdom has no canvas: the drawing is stubbed here, and proved for real by
// e2e/capture.spec.ts on the upload request. What this pins down: the
// orientation is applied, the size is nativePhotoSize's, JPEG at 0.85.
describe("reencodePhoto", () => {
  function stubCanvas(blob: Blob | null) {
    const drawImage = vi.fn();
    const toBlob = vi.fn((callback: (b: Blob | null) => void) => callback(blob));
    const canvas = { width: 0, height: 0, getContext: () => ({ drawImage }), toBlob };
    vi.spyOn(document, "createElement").mockReturnValue(canvas as never);
    return { canvas, drawImage, toBlob };
  }

  it("draws the upright photo at nativePhotoSize and encodes it as JPEG 0.85", async () => {
    const bitmap = { width: 3024, height: 4032, close: vi.fn() };
    const createImageBitmap = vi.fn().mockResolvedValue(bitmap);
    vi.stubGlobal("createImageBitmap", createImageBitmap);
    const encoded = new Blob(["jpeg"], { type: "image/jpeg" });
    const { canvas, drawImage, toBlob } = stubCanvas(encoded);
    const file = new Blob(["camera"]);

    const result = await reencodePhoto(file);

    expect(createImageBitmap).toHaveBeenCalledWith(file, { imageOrientation: "from-image" });
    const target = nativePhotoSize(3024, 4032);
    expect({ width: canvas.width, height: canvas.height }).toEqual(target);
    expect(drawImage).toHaveBeenCalledWith(bitmap, 0, 0, target.width, target.height);
    expect(toBlob).toHaveBeenCalledWith(expect.any(Function), "image/jpeg", 0.85);
    expect(JPEG_QUALITY).toBe(0.85);
    expect(bitmap.close).toHaveBeenCalled();
    expect(result).toBe(encoded);
  });

  it("rejects when the browser cannot decode the photo", async () => {
    vi.stubGlobal("createImageBitmap", vi.fn().mockRejectedValue(new Error("undecodable")));

    await expect(reencodePhoto(new Blob(["?"]))).rejects.toThrow();
  });

  it("rejects when the canvas produces nothing", async () => {
    vi.stubGlobal("createImageBitmap", vi.fn().mockResolvedValue({ width: 10, height: 10, close: vi.fn() }));
    stubCanvas(null);

    await expect(reencodePhoto(new Blob(["x"]))).rejects.toThrow();
  });
});

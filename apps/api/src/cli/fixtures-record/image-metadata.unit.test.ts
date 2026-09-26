import { describe, expect, it } from "vitest";
import { imageMetadataProblem } from "./image-metadata.js";

const segment = (marker: number, payload: number[]) => [0xff, marker, (payload.length + 2) >> 8, (payload.length + 2) & 0xff, ...payload];
const ascii = (text: string) => Array.from(text, (c) => c.charCodeAt(0));
const jpeg = (...segments: number[][]) => Uint8Array.from([0xff, 0xd8, ...segments.flat(), ...segment(0xda, [1, 1, 0, 0, 63, 0]), 0, 0xff, 0xd9]);
const pngChunk = (type: string, data: number[]) => [0, 0, 0, data.length, ...ascii(type), ...data, 0, 0, 0, 0];
const png = (...chunks: number[][]) => Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...chunks.flat()]);

// A raw phone photo in the repository would publish its EXIF, GPS
// included (the repository is public, docs/modules/ingestion.md).
describe("imageMetadataProblem", () => {
  it("accepts a JPEG with no metadata segment, or only JFIF", () => {
    expect(imageMetadataProblem("a.jpg", jpeg(segment(0xdb, [0])))).toBeNull();
    expect(imageMetadataProblem("a.jpg", jpeg(segment(0xe0, ascii("JFIF\0")), segment(0xdb, [0])))).toBeNull();
  });

  it("flags EXIF (GPS included) in a JPEG, whatever the extension's case", () => {
    const withExif = jpeg(segment(0xe1, [...ascii("Exif\0\0"), 1, 2, 3]));
    for (const name of ["a.jpg", "IMG_6371.JPG", "b.JpEg"]) expect(imageMetadataProblem(name, withExif)).toMatch(/EXIF|APP1/);
  });

  it("flags XMP, IPTC and comments in a JPEG", () => {
    expect(imageMetadataProblem("a.jpg", jpeg(segment(0xe1, ascii("http://ns.adobe.com/xap/1.0/\0"))))).not.toBeNull();
    expect(imageMetadataProblem("a.jpg", jpeg(segment(0xed, ascii("Photoshop 3.0\0"))))).not.toBeNull();
    expect(imageMetadataProblem("a.jpg", jpeg(segment(0xfe, ascii("comment"))))).not.toBeNull();
  });

  it("flags eXIf and text chunks in a PNG, accepts a bare one", () => {
    expect(imageMetadataProblem("a.png", png(pngChunk("IHDR", [0])))).toBeNull();
    expect(imageMetadataProblem("a.PNG", png(pngChunk("IHDR", [0]), pngChunk("eXIf", [1])))).not.toBeNull();
    expect(imageMetadataProblem("a.png", png(pngChunk("IHDR", [0]), pngChunk("tEXt", ascii("GPS"))))).not.toBeNull();
  });

  it("refuses raw phone formats outright", () => {
    for (const name of ["IMG_1.HEIC", "a.heif", "a.tiff", "a.DNG", "a.avif"]) expect(imageMetadataProblem(name, new Uint8Array(4))).not.toBeNull();
  });

  it("ignores what is not an image", () => {
    expect(imageMetadataProblem("legible.json", Uint8Array.from(ascii("{}")))).toBeNull();
  });
});

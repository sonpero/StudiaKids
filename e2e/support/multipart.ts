// APP1 segments carry EXIF (and GPS) or XMP; none may reach the server.
export function hasApp1Segment(jpeg: Uint8Array): boolean {
  let offset = 2;
  while (offset + 3 < jpeg.length && jpeg[offset] === 0xff) {
    const marker = jpeg[offset + 1];
    if (marker === 0xe1) return true;
    if (marker === 0xda) return false;
    offset += 2 + (((jpeg[offset + 2] ?? 0) << 8) | (jpeg[offset + 3] ?? 0));
  }
  return false;
}

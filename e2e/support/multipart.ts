// The file part of a multipart/form-data body, as the browser sent it.
export function firstFilePart(body: Buffer, contentType: string): Buffer {
  const boundary = /boundary=(?:"([^"]+)"|([^;]+))/.exec(contentType);
  const marker = boundary?.[1] ?? boundary?.[2];
  if (!marker) throw new Error(`no multipart boundary in ${contentType}`);
  const delimiter = Buffer.from(`--${marker}`);
  const start = body.indexOf(delimiter);
  const headersEnd = body.indexOf("\r\n\r\n", start);
  const end = body.indexOf(Buffer.from(`\r\n--${marker}`), headersEnd);
  if (start < 0 || headersEnd < 0 || end < 0) throw new Error("malformed multipart body");
  return body.subarray(headersEnd + 4, end);
}

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

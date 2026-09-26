import { nativePhotoSize } from "@studiakids/contracts";

// Decided at M2 (docs/ui.md).
export const JPEG_QUALITY = 0.85;

// Every photo leaves the capture screen re-encoded, never as the camera
// file (docs/modules/ingestion.md): the bitmap applies the EXIF
// orientation, the canvas keeps no metadata (GPS included), and the size is
// the largest the model sees without downscaling.
export async function reencodePhoto(file: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  try {
    const { width, height } = nativePhotoSize(bitmap.width, bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("no 2d canvas context");
    context.drawImage(bitmap, 0, 0, width, height);
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("the canvas produced no JPEG"))), "image/jpeg", JPEG_QUALITY);
    });
  } finally {
    bitmap.close();
  }
}

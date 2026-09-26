import { useRef, useState } from "react";
import { createCourse, pageFileUrl, startExtraction, uploadPage, type UploadError } from "./courses.js";

export type CaptureError = Exclude<UploadError, "not_found"> | "unreadable";
export type CapturedPage = { index: number; url: string };

// "gone": the course was replaced meanwhile (404), the caller goes home
// silently (docs/ui.md).
export type PhotoOutcome = "added" | "refused" | "gone";

// The photos of one course being captured: every photo is re-encoded
// first (docs/modules/ingestion.md), the course is created with its first
// page, and later pages go to that same course.
export function useCapture(reencode: (file: Blob) => Promise<Blob>) {
  const courseId = useRef<string | null>(null);
  const [pages, setPages] = useState<CapturedPage[]>([]);
  const [error, setError] = useState<CaptureError | null>(null);
  const [busy, setBusy] = useState(false);

  function reset(): void {
    for (const page of pages) if (page.url.startsWith("blob:")) URL.revokeObjectURL(page.url);
    courseId.current = null;
    setPages([]);
    setError(null);
  }

  // A course whose photos were taken but never sent to reading: its pages
  // are shown from the authenticated route, and new ones join it.
  function resume(id: string, pageCount: number): void {
    courseId.current = id;
    setPages(Array.from({ length: pageCount }, (_, index) => ({ index, url: pageFileUrl(id, index) })));
    setError(null);
  }

  async function addPhoto(file: File): Promise<PhotoOutcome> {
    setBusy(true);
    setError(null);
    try {
      let photo: Blob;
      try {
        photo = await reencode(file);
      } catch {
        setError("unreadable");
        return "refused";
      }
      courseId.current ??= await createCourse();
      const uploaded = await uploadPage(courseId.current, photo);
      if (!uploaded.ok) {
        if (uploaded.error === "not_found") return "gone";
        setError(uploaded.error);
        return "refused";
      }
      setPages((previous) => [...previous, { index: uploaded.index, url: URL.createObjectURL(photo) }]);
      return "added";
    } catch {
      setError("upload_failed");
      return "refused";
    } finally {
      setBusy(false);
    }
  }

  async function finish(): Promise<string | null> {
    const id = courseId.current;
    if (id) await startExtraction(id);
    return id;
  }

  return { pages, error, busy, reset, resume, addPhoto, finish };
}

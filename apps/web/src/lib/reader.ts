import { readerTextSchema, type ReaderTextDto } from "@studiakids/contracts";
import { HttpError } from "./http-error.js";

// docs/modules/reader.md. A 404 is a course deleted meanwhile: null, and
// the screen goes home; anything else unexpected is the error state.
export async function getCourseText(courseId: string): Promise<ReaderTextDto | null> {
  const res = await fetch(`/api/courses/${courseId}/text`);
  if (res.status === 404) return null;
  if (!res.ok) throw new HttpError(res.status, "GET /api/courses/:id/text");
  return readerTextSchema.parse(await res.json());
}

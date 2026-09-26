import { courseErrorSchema, courseListResponseSchema, createCourseResponseSchema, addPageResponseSchema, type CourseDto, type CourseError } from "@studiakids/contracts";

export type UploadError = CourseError | "upload_failed";
export type UploadResult = { ok: true; index: number } | { ok: false; error: UploadError };

// Unexpected statuses throw, for the calling screen's error state; the
// refusals a screen explains to the child come back as stable codes.
function expectOk(res: Response, what: string): Response {
  if (!res.ok) throw new Error(`${what} failed with status ${String(res.status)}`);
  return res;
}

export async function listCourses(): Promise<CourseDto[]> {
  const res = expectOk(await fetch("/api/courses"), "GET /api/courses");
  return courseListResponseSchema.parse(await res.json()).courses;
}

export async function createCourse(): Promise<string> {
  const res = expectOk(await fetch("/api/courses", { method: "POST" }), "POST /api/courses");
  return createCourseResponseSchema.parse(await res.json()).id;
}

export async function uploadPage(courseId: string, photo: Blob): Promise<UploadResult> {
  const body = new FormData();
  body.append("photo", photo, "page.jpg");
  try {
    const res = await fetch(`/api/courses/${courseId}/pages`, { method: "POST", body });
    if (res.ok) return { ok: true, index: addPageResponseSchema.parse(await res.json()).index };
    const refusal = courseErrorSchema.safeParse(await res.json().catch(() => null));
    return { ok: false, error: refusal.success ? refusal.data.error : "upload_failed" };
  } catch {
    return { ok: false, error: "upload_failed" };
  }
}

export async function startExtraction(courseId: string): Promise<void> {
  expectOk(await fetch(`/api/courses/${courseId}/extract`, { method: "POST" }), "POST /api/courses/:id/extract");
}

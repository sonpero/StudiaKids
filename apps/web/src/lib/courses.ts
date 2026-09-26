import {
  addPageResponseSchema,
  courseErrorSchema,
  courseListResponseSchema,
  courseSchema,
  createCourseResponseSchema,
  unconfirmedCourseResponseSchema,
  type CourseDto,
  type CourseError,
  type ExtractionStatus,
} from "@studiakids/contracts";
import { HttpError } from "./http-error.js";

export type UploadError = CourseError | "upload_failed";
export type UploadResult = { ok: true; index: number } | { ok: false; error: UploadError };

// Unexpected statuses throw, for the calling screen's error state; the
// refusals a screen explains to the child come back as stable codes.
function expectOk(res: Response, what: string): Response {
  if (!res.ok) throw new HttpError(res.status, what);
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

// A course that answers 404 was replaced meanwhile by a new photo (one
// unconfirmed course per account): null, and the screen goes home
// silently (docs/ui.md).
export async function getCourse(courseId: string): Promise<CourseDto | null> {
  const res = await fetch(`/api/courses/${courseId}`);
  if (res.status === 404) return null;
  return courseSchema.parse(await expectOk(res, "GET /api/courses/:id").json());
}

export async function getUnconfirmedCourse(): Promise<CourseDto | null> {
  const res = expectOk(await fetch("/api/courses/unconfirmed"), "GET /api/courses/unconfirmed");
  return unconfirmedCourseResponseSchema.parse(await res.json()).course;
}

async function post(courseId: string, action: "confirm" | "reject" | "retry"): Promise<void> {
  expectOk(await fetch(`/api/courses/${courseId}/${action}`, { method: "POST" }), `POST /api/courses/:id/${action}`);
}

export const confirmCourse = (courseId: string) => post(courseId, "confirm");
export const rejectCourse = (courseId: string) => post(courseId, "reject");
export const retryExtraction = (courseId: string) => post(courseId, "retry");

// Photos are never static files (CLAUDE.md, Fichiers).
export function pageFileUrl(courseId: string, index: number): string {
  return `/api/courses/${courseId}/pages/${String(index)}/file`;
}

const SLOW_AFTER_MS = 30_000;

// docs/ui.md, "Travail asynchrone": refetchInterval while the status is not
// final, slowed after 30 seconds, as in StudIA.
export function pollInterval(status: ExtractionStatus, elapsedMs: number): number | false {
  if (status !== "pending" && status !== "running") return false;
  return elapsedMs < SLOW_AFTER_MS ? 1000 : 5000;
}

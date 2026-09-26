import {
  addPageResponseSchema,
  courseErrorSchema,
  courseListResponseSchema,
  courseParamsSchema,
  courseSchema,
  createCourseResponseSchema,
  pageFileParamsSchema,
  unconfirmedCourseResponseSchema,
  type CourseDto,
  type CourseError,
} from "@studiakids/contracts";
import {
  addPage,
  confirmCourse,
  createCourse,
  deleteCourse,
  getCourse,
  getUnconfirmedCourse,
  listConfirmedCourses,
  readPageFile,
  rejectCourse,
  retryExtraction,
  startExtraction,
  type AddPageError,
  type Clock,
  type Course,
  type CourseRepository,
  type CourseView,
  type FileStore,
  type IdGenerator,
  type JobQueue,
} from "@studiakids/core";
import type { FastifyPluginCallback, FastifyReply } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";

export interface CourseRoutesOptions {
  repo: CourseRepository;
  fileStore: FileStore;
  jobQueue: JobQueue;
  idGenerator: IdGenerator;
  clock: Clock;
}

type DomainError = AddPageError | "no-pages" | "not-pending" | "not-ready" | "already-confirmed" | "not-failed";

const CODES: Record<DomainError | "missing-file", CourseError> = {
  "not-found": "not_found",
  "missing-file": "missing_file",
  locked: "locked",
  unsupported: "unsupported",
  "too-large": "too_large",
  "too-many-pages": "too_many_pages",
  duplicate: "duplicate",
  "no-pages": "no_pages",
  "not-pending": "not_pending",
  "not-ready": "not_ready",
  "already-confirmed": "already_confirmed",
  "not-failed": "not_failed",
};

const STATUSES: Record<CourseError, 400 | 404 | 409 | 413 | 415> = {
  not_found: 404,
  missing_file: 400,
  locked: 409,
  unsupported: 415,
  too_large: 413,
  too_many_pages: 409,
  duplicate: 409,
  no_pages: 409,
  not_pending: 409,
  not_ready: 409,
  already_confirmed: 409,
  not_failed: 409,
};

// The one place where ingestion's errors become HTTP (CLAUDE.md,
// Conventions). A not-found body and headers never depend on whether the
// course exists for another account (docs/securite.md).
function sendError(reply: FastifyReply, error: DomainError | "missing-file") {
  const code = CODES[error];
  return reply.code(STATUSES[code]).send({ error: code });
}

function toDto(course: Course | CourseView): CourseDto {
  return {
    id: course.id,
    title: course.title,
    subject: course.subject,
    grade: course.grade,
    color: course.color,
    extractionStatus: course.extractionStatus,
    confirmed: course.confirmed,
    pageCount: course.pageCount,
    createdAt: course.createdAt,
    lastAccessedAt: course.lastAccessedAt,
  };
}

const empty = z.undefined();
// Fastify sends a Buffer as is, without running the serializer.
const photo = z.instanceof(Buffer);

const errors = { 400: courseErrorSchema, 404: courseErrorSchema, 409: courseErrorSchema, 413: courseErrorSchema, 415: courseErrorSchema };

export const courseRoutes: FastifyPluginCallback<CourseRoutesOptions> = (fastify, opts, done) => {
  const app = fastify.withTypeProvider<ZodTypeProvider>();
  const { repo, fileStore, jobQueue } = opts;

  // Not marked config.public: the global requireAuth hook guarantees
  // request.user on every route below (plugins/auth.ts).
  app.post("/api/courses", { schema: { response: { 201: createCourseResponseSchema } } }, async (request, reply) => {
    const user = request.user!;
    const created = await createCourse({ repo, fileStore, idGenerator: opts.idGenerator }, user.id, user.grade, opts.clock.now());
    // Its error type is never: creating a course cannot fail.
    if (!created.ok) return created.error;
    return reply.code(201).send(created.value);
  });

  app.get("/api/courses", { schema: { response: { 200: courseListResponseSchema } } }, async (request) => {
    const courses = await listConfirmedCourses({ repo }, request.user!.id);
    return { courses: courses.map(toDto) };
  });

  app.get("/api/courses/unconfirmed", { schema: { response: { 200: unconfirmedCourseResponseSchema } } }, async (request) => {
    const course = await getUnconfirmedCourse({ repo, jobQueue }, request.user!.id);
    return { course: course ? toDto(course) : null };
  });

  app.get("/api/courses/:id", { schema: { params: courseParamsSchema, response: { 200: courseSchema, ...errors } } }, async (request, reply) => {
    const result = await getCourse({ repo, jobQueue }, request.user!.id, request.params.id);
    if (!result.ok) return sendError(reply, result.error);
    return toDto(result.value);
  });

  app.post(
    "/api/courses/:id/pages",
    { schema: { params: courseParamsSchema, response: { 201: addPageResponseSchema, ...errors } } },
    async (request, reply) => {
      let bytes: Buffer;
      try {
        const file = await request.file();
        if (!file) return sendError(reply, "missing-file");
        bytes = await file.toBuffer();
      } catch (error) {
        // Raised by the multipart limits set in app.ts, before anything is
        // written: the photo never reaches the disk or the database.
        if (error instanceof fastify.multipartErrors.RequestFileTooLargeError) return sendError(reply, "too-large");
        throw error;
      }

      const result = await addPage({ repo, fileStore }, request.user!.id, request.params.id, new Uint8Array(bytes), opts.clock.now());
      if (!result.ok) return sendError(reply, result.error);
      return reply.code(201).send({ index: result.value.index });
    },
  );

  // startExtraction is idempotent while a job is waiting, so a double tap
  // on "C'est tout !" gets the same 202 twice.
  app.post("/api/courses/:id/extract", { schema: { params: courseParamsSchema, response: { 202: empty, ...errors } } }, async (request, reply) => {
    const result = await startExtraction({ repo, jobQueue }, request.user!.id, request.params.id, opts.clock.now());
    if (!result.ok) return sendError(reply, result.error);
    return reply.code(202).send();
  });

  app.get("/api/courses/:id/pages/:index/file", { schema: { params: pageFileParamsSchema, response: { 200: photo, ...errors } } }, async (request, reply) => {
    const result = await readPageFile({ repo, fileStore }, request.user!.id, request.params.id, request.params.index);
    if (!result.ok) return sendError(reply, result.error);
    // Only JPEGs are ever stored (addPage re-checks the bytes); nosniff and
    // no-store keep a child's photo out of any guessing or shared cache.
    return reply
      .header("Content-Type", "image/jpeg")
      .header("X-Content-Type-Options", "nosniff")
      .header("Cache-Control", "private, no-store")
      .send(Buffer.from(result.value));
  });

  app.post("/api/courses/:id/confirm", { schema: { params: courseParamsSchema, response: { 204: empty, ...errors } } }, async (request, reply) => {
    const result = await confirmCourse({ repo }, request.user!.id, request.params.id, opts.clock.now());
    if (!result.ok) return sendError(reply, result.error);
    return reply.code(204).send();
  });

  app.post("/api/courses/:id/reject", { schema: { params: courseParamsSchema, response: { 204: empty, ...errors } } }, async (request, reply) => {
    const result = await rejectCourse({ repo, fileStore }, request.user!.id, request.params.id, opts.clock.now());
    if (!result.ok) return sendError(reply, result.error);
    return reply.code(204).send();
  });

  app.post("/api/courses/:id/retry", { schema: { params: courseParamsSchema, response: { 202: empty, ...errors } } }, async (request, reply) => {
    const result = await retryExtraction({ repo, jobQueue }, request.user!.id, request.params.id, opts.clock.now());
    if (!result.ok) return sendError(reply, result.error);
    return reply.code(202).send();
  });

  app.delete("/api/courses/:id", { schema: { params: courseParamsSchema, response: { 204: empty, ...errors } } }, async (request, reply) => {
    const result = await deleteCourse({ repo, fileStore }, request.user!.id, request.params.id);
    if (!result.ok) return sendError(reply, result.error);
    return reply.code(204).send();
  });

  done();
};

import { courseErrorSchema, courseParamsSchema, readerTextSchema, type CourseError } from "@studiakids/contracts";
import { openCourseForReading, type Clock, type CourseRepository } from "@studiakids/core";
import type { FastifyPluginCallback } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";

export interface ReaderRoutesOptions {
  repo: CourseRepository;
  clock: Clock;
}

const CODES = { "not-found": { status: 404, error: "not_found" }, "not-ready": { status: 409, error: "not_ready" } } as const satisfies Record<
  string,
  { status: 404 | 409; error: CourseError }
>;

// docs/modules/reader.md. Same error codes as the course routes: the
// reader is a view of a course (a 404 identical for another account's).
export const readerRoutes: FastifyPluginCallback<ReaderRoutesOptions> = (fastify, opts, done) => {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  app.get(
    "/api/courses/:id/text",
    { schema: { params: courseParamsSchema, response: { 200: readerTextSchema, 404: courseErrorSchema, 409: courseErrorSchema } } },
    async (request, reply) => {
      const result = await openCourseForReading({ repo: opts.repo }, request.user!.id, request.params.id, opts.clock.now());
      if (!result.ok) {
        const { status, error } = CODES[result.error];
        return reply.code(status).send({ error });
      }
      return result.value;
    },
  );

  done();
};

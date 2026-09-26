import {
  answerRequestSchema,
  answerResponseSchema,
  courseErrorSchema,
  courseParamsSchema,
  exerciseParamsSchema,
  playErrorSchema,
  playableListResponseSchema,
} from "@studiakids/contracts";
import { listPlayableExercises, playExercise, type AttemptRepository, type Clock, type ExerciseSource, type IdGenerator } from "@studiakids/core";
import type { FastifyPluginCallback, FastifyReply } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";

export interface PlayRoutesOptions {
  exercises: ExerciseSource;
  attempts: AttemptRepository;
  idGenerator: IdGenerator;
  clock: Clock;
}

type DomainError = "not-found" | "not-ready" | "invalid-answer";

const CODES = {
  "not-found": { status: 404, error: "not_found" },
  "not-ready": { status: 409, error: "not_ready" },
  "invalid-answer": { status: 400, error: "invalid_answer" },
} as const satisfies Record<DomainError, { status: number; error: string }>;

// The one place where game-engine's errors become HTTP. A course or an
// exercise of another account answers exactly like an unknown id
// (docs/securite.md).
function sendError(reply: FastifyReply, domainError: DomainError) {
  const { status, error } = CODES[domainError];
  return reply.code(status).send({ error });
}

// docs/modules/game-engine.md, API.
export const playRoutes: FastifyPluginCallback<PlayRoutesOptions> = (fastify, opts, done) => {
  const app = fastify.withTypeProvider<ZodTypeProvider>();
  const { exercises, attempts } = opts;

  app.get(
    "/api/courses/:id/exercises",
    { schema: { params: courseParamsSchema, response: { 200: playableListResponseSchema, 404: courseErrorSchema, 409: courseErrorSchema } } },
    async (request, reply) => {
      const user = request.user!;
      const result = await listPlayableExercises({ exercises, attempts }, user.id, request.params.id, user.grade);
      if (!result.ok) return sendError(reply, result.error);
      return result.value;
    },
  );

  app.post(
    "/api/exercises/:id/answer",
    { schema: { params: exerciseParamsSchema, body: answerRequestSchema, response: { 200: answerResponseSchema, 400: playErrorSchema, 404: playErrorSchema } } },
    async (request, reply) => {
      const { givenAnswer, reread } = request.body;
      const result = await playExercise({ exercises, attempts, idGenerator: opts.idGenerator }, request.user!.id, request.params.id, givenAnswer, { reread: reread === true }, opts.clock.now());
      if (!result.ok) return sendError(reply, result.error);
      return result.value;
    },
  );

  done();
};

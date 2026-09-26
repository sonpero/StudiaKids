import {
  courseErrorSchema,
  courseParamsSchema,
  exerciseListResponseSchema,
  generationStatusSchema,
  itemListResponseSchema,
  itemParamsSchema,
  type CourseError,
  type ExerciseDto,
  type ItemDto,
} from "@studiakids/contracts";
import {
  getGenerationStatus,
  regenerateItem,
  startGeneration,
  type Clock,
  type CourseTextSource,
  type Exercise,
  type Item,
  type ItemRepository,
  type JobQueue,
} from "@studiakids/core";
import type { FastifyPluginCallback, FastifyReply } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";

export interface GenerationRoutesOptions {
  courses: CourseTextSource;
  repo: ItemRepository;
  jobQueue: JobQueue;
  clock: Clock;
}

type DomainError = "not-found" | "not-ready";

const CODES: Record<DomainError, { status: 404 | 409; error: CourseError }> = {
  "not-found": { status: 404, error: "not_found" },
  "not-ready": { status: 409, error: "not_ready" },
};

// The one place where exercise-generator's errors become HTTP. A course or
// an item of another account answers exactly like an unknown id
// (docs/securite.md).
function sendError(reply: FastifyReply, domainError: DomainError) {
  const { status, error } = CODES[domainError];
  return reply.code(status).send({ error });
}

const toItemDto = (item: Item): ItemDto => ({ id: item.id, title: item.title, body: item.body, gameTypes: item.applicableGameTypes, position: item.position });
const toExerciseDto = (exercise: Exercise): ExerciseDto => ({ id: exercise.id, itemId: exercise.itemId, type: exercise.type, content: exercise.content });

const errors = { 404: courseErrorSchema, 409: courseErrorSchema };

// docs/modules/exercise-generator.md, API.
export const generationRoutes: FastifyPluginCallback<GenerationRoutesOptions> = (fastify, opts, done) => {
  const app = fastify.withTypeProvider<ZodTypeProvider>();
  const { courses, repo, jobQueue } = opts;

  // « Créer mes jeux »: the same 202 carrying the current status, however
  // many times it is tapped.
  app.post("/api/courses/:id/generate", { schema: { params: courseParamsSchema, response: { 202: generationStatusSchema, ...errors } } }, async (request, reply) => {
    const result = await startGeneration({ courses, repo, jobQueue }, request.user!.id, request.params.id, opts.clock.now());
    if (!result.ok) return sendError(reply, result.error);
    return reply.code(202).send(result.value);
  });

  app.get("/api/courses/:id/generation-status", { schema: { params: courseParamsSchema, response: { 200: generationStatusSchema, ...errors } } }, async (request, reply) => {
    const userId = request.user!.id;
    const text = await courses.read(userId, request.params.id);
    if (!text.ok) return sendError(reply, text.error);
    return getGenerationStatus({ repo, jobQueue }, userId, request.params.id);
  });

  app.get("/api/courses/:id/items", { schema: { params: courseParamsSchema, response: { 200: itemListResponseSchema, ...errors } } }, async (request, reply) => {
    const userId = request.user!.id;
    const text = await courses.read(userId, request.params.id);
    if (!text.ok) return sendError(reply, text.error);
    return { items: (await repo.listItems(userId, request.params.id)).map(toItemDto) };
  });

  app.get("/api/items/:id/exercises", { schema: { params: itemParamsSchema, response: { 200: exerciseListResponseSchema, ...errors } } }, async (request, reply) => {
    const userId = request.user!.id;
    const item = await repo.findItem(userId, request.params.id);
    if (!item) return sendError(reply, "not-found");
    return { exercises: (await repo.listExercises(userId, [item.id])).map(toExerciseDto) };
  });

  app.post("/api/items/:id/regenerate", { schema: { params: itemParamsSchema, response: { 202: z.undefined(), ...errors } } }, async (request, reply) => {
    const result = await regenerateItem({ repo, jobQueue }, request.user!.id, request.params.id, opts.clock.now());
    if (!result.ok) return sendError(reply, result.error);
    return reply.code(202).send();
  });

  done();
};

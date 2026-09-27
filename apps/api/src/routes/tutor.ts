import {
  askRequestSchema,
  conversationDetailSchema,
  conversationListResponseSchema,
  conversationParamsSchema,
  courseParamsSchema,
  startConversationResponseSchema,
  tutorErrorSchema,
  type ConversationDto,
  type TutorMessageDto,
} from "@studiakids/contracts";
import {
  ask,
  deleteConversation,
  fixedText,
  getConversation,
  listConversations,
  openConversation,
  type Clock,
  type Conversation,
  type ConversationRepository,
  type IdGenerator,
  type Message,
  type TutorCourseSource,
} from "@studiakids/core";
import type { FastifyPluginCallback } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import type { TutorModels } from "../tutor-models.js";

export interface TutorRoutesOptions {
  repo: ConversationRepository;
  courses: TutorCourseSource;
  models: TutorModels;
  idGenerator: IdGenerator;
  clock: Clock;
}

const CODES = { "not-found": { status: 404, error: "not_found" }, "not-ready": { status: 409, error: "not_ready" } } as const;

const toConversation = ({ id, courseId, title, createdAt }: Conversation): ConversationDto => ({ id, courseId, title, createdAt });
const toMessage = ({ id, role, content, citations, issue, outOfBand, partial, createdAt }: Message): TutorMessageDto => ({ id, role, content, citations, issue, outOfBand, partial, createdAt });

const sse = (event: string, data: unknown) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

// docs/modules/tutor.md, API. Another account's conversation or course is
// a 404 identical to an unknown id (docs/securite.md).
export const tutorRoutes: FastifyPluginCallback<TutorRoutesOptions> = (fastify, opts, done) => {
  const app = fastify.withTypeProvider<ZodTypeProvider>();
  const deps = { repo: opts.repo, courses: opts.courses, idGenerator: opts.idGenerator };

  app.post(
    "/api/courses/:id/conversations",
    { schema: { params: courseParamsSchema, response: { 200: startConversationResponseSchema, 404: tutorErrorSchema, 409: tutorErrorSchema } } },
    async (request, reply) => {
      const result = await openConversation(deps, request.user!.id, request.params.id, opts.clock.now());
      if (!result.ok) return reply.code(CODES[result.error].status).send({ error: CODES[result.error].error });
      return { conversation: toConversation(result.value.conversation), showDisclosure: result.value.showDisclosure };
    },
  );

  app.get(
    "/api/courses/:id/conversations",
    { schema: { params: courseParamsSchema, response: { 200: conversationListResponseSchema, 404: tutorErrorSchema, 409: tutorErrorSchema } } },
    async (request, reply) => {
      const result = await listConversations(deps, request.user!.id, request.params.id);
      if (!result.ok) return reply.code(CODES[result.error].status).send({ error: CODES[result.error].error });
      return { conversations: result.value.map(toConversation) };
    },
  );

  app.get(
    "/api/conversations/:id",
    { schema: { params: conversationParamsSchema, response: { 200: conversationDetailSchema, 404: tutorErrorSchema } } },
    async (request, reply) => {
      const result = await getConversation(deps, request.user!.id, request.params.id);
      if (!result.ok) return reply.code(404).send({ error: "not_found" });
      return { conversation: toConversation(result.value.conversation), messages: result.value.messages.map(toMessage) };
    },
  );

  app.delete("/api/conversations/:id", { schema: { params: conversationParamsSchema, response: { 204: z.undefined(), 404: tutorErrorSchema } } }, async (request, reply) => {
    const result = await deleteConversation(deps, request.user!.id, request.params.id);
    if (!result.ok) return reply.code(404).send({ error: "not_found" });
    return reply.code(204).send();
  });

  // SSE: text chunks for a complete answer only, then one terminal event
  // named after the outcome. A refusal, distress, failure or cap streams no
  // text at all: the decision is known before any.
  app.post(
    "/api/conversations/:id/messages",
    { schema: { params: conversationParamsSchema, body: askRequestSchema, response: { 404: tutorErrorSchema, 409: tutorErrorSchema } } },
    async (request, reply) => {
      const result = await ask({ ...deps, ...opts.models }, { userId: request.user!.id, conversationId: request.params.id, question: request.body.question }, opts.clock.now());
      if (!result.ok) return reply.code(CODES[result.error].status).send({ error: CODES[result.error].error });

      reply.hijack();
      reply.raw.writeHead(200, { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache", Connection: "keep-alive" });
      // Read to the end even if the child has left: the exchange is saved
      // and waits for them (docs/ui.md, nothing blocks on a model).
      const write = (text: string) => {
        if (!reply.raw.destroyed) reply.raw.write(text);
      };
      try {
        for await (const event of result.value) {
          write(event.type === "chunk" ? sse("chunk", { text: event.text }) : sse(event.type, { message: toMessage(event.message) }));
        }
      } catch (error) {
        // Never a connection left without a terminal event: the fixed
        // « ask again » message, not stored (writing is what failed).
        request.log.error(error);
        const now = opts.clock.now().toISOString();
        write(sse("unavailable", { message: { id: "", role: "assistant", content: fixedText("unavailable"), citations: null, issue: "unavailable", outOfBand: false, partial: false, createdAt: now } }));
      }
      reply.raw.end();
      return reply;
    },
  );

  done();
};

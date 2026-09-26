import { progressQuerySchema, progressSchema } from "@studiakids/contracts";
import { getProgress, type AttemptsQuery } from "@studiakids/core";
import type { FastifyPluginCallback } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";

export interface ProgressRoutesOptions {
  attempts: AttemptsQuery;
}

// docs/modules/progress.md, API: the connected account's counters, derived
// at every read from its attempts. No id in the route: nothing of another
// account can even be asked for.
export const progressRoutes: FastifyPluginCallback<ProgressRoutesOptions> = (fastify, opts, done) => {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  app.get("/api/progress", { schema: { querystring: progressQuerySchema, response: { 200: progressSchema } } }, async (request) => {
    const { submission: _submission, ...view } = await getProgress({ attempts: opts.attempts }, request.user!.id, { since: request.query.since });
    return view;
  });

  done();
};

import fastifyStatic from "@fastify/static";
import type { FastifyInstance } from "fastify";

/**
 * Serves the built React SPA from the server in production/Docker so the
 * container only needs to expose one port. In dev, Vite's own server
 * handles the frontend and proxies /api + /ws to this server instead.
 */
export async function registerStaticFrontend(app: FastifyInstance, webDistPath: string) {
  await app.register(fastifyStatic, {
    root: webDistPath,
    wildcard: false,
  });

  app.setNotFoundHandler((request, reply) => {
    if (request.url.startsWith("/api") || request.url.startsWith("/ws")) {
      return reply.code(404).send({ error: "Not found" });
    }
    return reply.sendFile("index.html");
  });
}

import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import type { GroupService } from "../../domain/groups/service.js";

const idParamSchema = z.object({ id: z.coerce.number().int().positive() });
const createGroupSchema = z.object({ name: z.string().min(1).max(100) });
const commandSchema = z.object({ command: z.string().min(1).max(500) });

export const groupRoutes: FastifyPluginAsync<{ groups: GroupService }> = async (app, { groups }) => {
  app.get("/", async () => groups.list());

  app.post("/", async (request, reply) => {
    const { name } = createGroupSchema.parse(request.body);
    reply.code(201);
    return groups.create(name);
  });

  app.delete("/:id", async (request, reply) => {
    const { id } = idParamSchema.parse(request.params);
    groups.delete(id);
    reply.code(204);
  });

  app.post("/:id/command", async (request) => {
    const { id } = idParamSchema.parse(request.params);
    const { command } = commandSchema.parse(request.body);
    return groups.sendCommand(id, command);
  });
};

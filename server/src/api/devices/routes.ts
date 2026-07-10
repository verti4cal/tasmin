import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import type { DeviceService } from "../../domain/devices/service.js";
import { createDeviceSchema, sendCommandSchema, updateDeviceSchema } from "../../domain/devices/types.js";

const idParamSchema = z.object({ id: z.coerce.number().int().positive() });

export const deviceRoutes: FastifyPluginAsync<{ devices: DeviceService }> = async (app, { devices }) => {
  app.get("/", async () => devices.listWithState());

  app.get("/:id", async (request) => {
    const { id } = idParamSchema.parse(request.params);
    return devices.getByIdWithState(id);
  });

  app.post("/", async (request, reply) => {
    const body = createDeviceSchema.parse(request.body);
    const device = devices.create(body);
    reply.code(201);
    return device;
  });

  app.patch("/:id", async (request) => {
    const { id } = idParamSchema.parse(request.params);
    const body = updateDeviceSchema.parse(request.body);
    return devices.update(id, body);
  });

  app.delete("/:id", async (request, reply) => {
    const { id } = idParamSchema.parse(request.params);
    devices.delete(id);
    reply.code(204);
  });

  app.post("/:id/command", async (request) => {
    const { id } = idParamSchema.parse(request.params);
    const { command } = sendCommandSchema.parse(request.body);
    return devices.sendCommand(id, command);
  });
};

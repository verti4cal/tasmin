import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import type { DeviceStateService } from "../../domain/devices/stateService.js";

const idParamSchema = z.object({ id: z.coerce.number().int().positive() });
const historyQuerySchema = z.object({
  key: z.string().min(1).max(200),
  hours: z.coerce.number().positive().max(24 * 30).default(24),
});

export const telemetryRoutes: FastifyPluginAsync<{ state: DeviceStateService }> = async (
  app,
  { state },
) => {
  app.get("/:id/telemetry/keys", async (request) => {
    const { id } = idParamSchema.parse(request.params);
    return state.listTelemetryKeys(id);
  });

  app.get("/:id/telemetry", async (request) => {
    const { id } = idParamSchema.parse(request.params);
    const { key, hours } = historyQuerySchema.parse(request.query);
    return state.getTelemetryHistory(id, key, hours);
  });
};

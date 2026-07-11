import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import type { BuildQueue } from "../../domain/firmware/queue.js";
import type { OtaService } from "../../domain/ota/service.js";

const pushSchema = z.object({
  buildId: z.coerce.number().int().positive(),
  deviceIds: z.array(z.coerce.number().int().positive()).min(1),
  compressed: z.coerce.boolean().default(false),
  backupFirst: z.coerce.boolean().default(true),
});

export const otaRoutes: FastifyPluginAsync<{ ota: OtaService; builds: BuildQueue }> = async (
  app,
  { ota, builds },
) => {
  app.get("/status", async () => ({ running: ota.isRunning() }));

  app.post("/push", async (request, reply) => {
    const { buildId, deviceIds, compressed, backupFirst } = pushSchema.parse(request.body);
    builds.getBinaryPath(buildId, { compressed }); // throws NotFoundError -> 404 if that variant doesn't exist

    if (ota.isRunning()) {
      return reply.code(409).send({ error: "An OTA update is already in progress" });
    }

    reply.code(202);
    void ota.pushToDevices(buildId, deviceIds, { compressed, backupFirst });
    return { status: "started", total: deviceIds.length };
  });
};

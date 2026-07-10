import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import type { BackupService } from "../../domain/devices/backupService.js";

const idParamSchema = z.object({ id: z.coerce.number().int().positive() });
const backupParamSchema = idParamSchema.extend({
  backupId: z.coerce.number().int().positive(),
});

export const backupRoutes: FastifyPluginAsync<{ backups: BackupService }> = async (
  app,
  { backups },
) => {
  app.post("/:id/backups", async (request, reply) => {
    const { id } = idParamSchema.parse(request.params);
    const backup = await backups.create(id);
    reply.code(201);
    return backup;
  });

  app.get("/:id/backups", async (request) => {
    const { id } = idParamSchema.parse(request.params);
    return backups.list(id);
  });

  app.get("/:id/backups/:backupId/download", async (request, reply) => {
    const { id, backupId } = backupParamSchema.parse(request.params);
    const backup = backups.getWithBlob(id, backupId);
    reply.header("Content-Type", "application/octet-stream");
    reply.header("Content-Disposition", `attachment; filename="${backup.filename}"`);
    return backup.data;
  });

  app.post("/:id/backups/:backupId/restore", async (request) => {
    const { id, backupId } = backupParamSchema.parse(request.params);
    await backups.restore(id, backupId);
    return { status: "restored" };
  });

  app.delete("/:id/backups/:backupId", async (request, reply) => {
    const { id, backupId } = backupParamSchema.parse(request.params);
    backups.delete(id, backupId);
    reply.code(204);
  });
};

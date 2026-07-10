import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import type { BuildQueue } from "../../domain/firmware/queue.js";
import type { PresetService } from "../../domain/firmware/presetService.js";
import type { TagService } from "../../domain/firmware/tagService.js";

const idParamSchema = z.object({ id: z.coerce.number().int().positive() });
const pushParamSchema = z.object({
  id: z.coerce.number().int().positive(),
  deviceId: z.coerce.number().int().positive(),
});

const createBuildSchema = z.object({
  baseVersion: z.string().min(1).max(100),
  env: z.string().min(1).max(50),
  overrides: z.string().max(10_000).default(""),
  buildFlags: z.string().max(2000).default(""),
  presetName: z.string().min(1).max(100).optional(),
});

const createPresetSchema = z.object({
  name: z.string().min(1).max(100),
  baseVersion: z.string().min(1).max(100),
  env: z.string().min(1).max(50),
  overrides: z.string().max(10_000).default(""),
  buildFlags: z.string().max(2000).default(""),
});

const prebuiltVariantsQuerySchema = z.object({ version: z.string().min(1).max(100) });
const downloadPrebuiltSchema = z.object({
  baseVersion: z.string().min(1).max(100),
  env: z.string().min(1).max(100),
});

const downloadQuerySchema = z.object({ compressed: z.coerce.boolean().default(false) });
const pushBodySchema = z.object({ compressed: z.coerce.boolean().default(false) });

export const firmwareRoutes: FastifyPluginAsync<{
  builds: BuildQueue;
  presets: PresetService;
  tags: TagService;
}> = async (app, { builds, presets, tags }) => {
  app.get("/tags", async () => tags.list());

  app.get("/builds", async () => builds.list());

  app.post("/builds", async (request, reply) => {
    const input = createBuildSchema.parse(request.body);
    reply.code(201);
    return builds.enqueue(input);
  });

  app.get("/builds/:id", async (request) => {
    const { id } = idParamSchema.parse(request.params);
    return builds.getById(id);
  });

  app.get("/builds/:id/log", async (request, reply) => {
    const { id } = idParamSchema.parse(request.params);
    reply.header("Content-Type", "text/plain; charset=utf-8");
    return builds.getLog(id);
  });

  app.get("/builds/:id/download", async (request, reply) => {
    const { id } = idParamSchema.parse(request.params);
    const { compressed } = downloadQuerySchema.parse(request.query);
    const binaryPath = builds.getBinaryPath(id, { compressed });
    const filename = compressed ? `firmware-${id}.bin.gz` : `firmware-${id}.bin`;
    // Tasmota's OTA HTTP client refuses to download without a Content-Length
    // (fails with "Server Did Not Report Size") — Fastify won't set it for a
    // raw stream on its own, so it has to be stat'd and set explicitly.
    const { size } = await stat(binaryPath);
    reply.header("Content-Type", compressed ? "application/gzip" : "application/octet-stream");
    reply.header("Content-Disposition", `attachment; filename="${filename}"`);
    reply.header("Content-Length", size);
    return reply.send(createReadStream(binaryPath));
  });

  app.delete("/builds/:id", async (request, reply) => {
    const { id } = idParamSchema.parse(request.params);
    await builds.delete(id);
    reply.code(204);
  });

  app.post("/builds/:id/push/:deviceId", async (request) => {
    const { id, deviceId } = pushParamSchema.parse(request.params);
    const { compressed } = pushBodySchema.parse(request.body ?? {});
    await builds.pushToDevice(id, deviceId, { compressed });
    return { status: "pushed" };
  });

  app.get("/prebuilt/variants", async (request) => {
    const { version } = prebuiltVariantsQuerySchema.parse(request.query);
    return builds.listPrebuiltVariants(version);
  });

  app.post("/prebuilt", async (request, reply) => {
    const { baseVersion, env } = downloadPrebuiltSchema.parse(request.body);
    const build = await builds.downloadPrebuilt(baseVersion, env);
    reply.code(201);
    return build;
  });

  app.get("/presets", async () => presets.list());

  app.post("/presets", async (request, reply) => {
    const input = createPresetSchema.parse(request.body);
    reply.code(201);
    return presets.create(input);
  });

  app.delete("/presets/:id", async (request, reply) => {
    const { id } = idParamSchema.parse(request.params);
    presets.delete(id);
    reply.code(204);
  });
};

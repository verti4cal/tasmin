import cors from "@fastify/cors";
import websocket from "@fastify/websocket";
import Fastify from "fastify";
import { ZodError } from "zod";
import { backupRoutes } from "./api/devices/backupRoutes.js";
import { deviceRoutes } from "./api/devices/routes.js";
import { ruleRoutes } from "./api/devices/ruleRoutes.js";
import { telemetryRoutes } from "./api/devices/telemetryRoutes.js";
import { firmwareRoutes } from "./api/firmware/routes.js";
import { groupRoutes } from "./api/groups/routes.js";
import { networkRoutes } from "./api/network/routes.js";
import { otaRoutes } from "./api/ota/routes.js";
import { config } from "./config.js";
import { BackupService } from "./domain/devices/backupService.js";
import { RuleService } from "./domain/devices/ruleService.js";
import { ScanService } from "./domain/devices/scanService.js";
import { DeviceService } from "./domain/devices/service.js";
import { DeviceStateService } from "./domain/devices/stateService.js";
import { BuildQueue } from "./domain/firmware/queue.js";
import { PresetService } from "./domain/firmware/presetService.js";
import { TagService } from "./domain/firmware/tagService.js";
import { GroupService } from "./domain/groups/service.js";
import { OtaService } from "./domain/ota/service.js";
import { ConfigurationError, ConflictError, NotFoundError, OtaVerificationError } from "./domain/errors.js";
import { InvalidCidrError } from "./infra/network/cidr.js";
import { setTagsLogger } from "./infra/firmware/tags.js";
import { PrebuiltNotFoundError, setPrebuiltLogger } from "./infra/firmware/prebuilt.js";
import { setTasmotaLogger, TasmotaHttpError } from "./infra/tasmota/client.js";
import type { Db } from "./infra/db/client.js";
import { registerStaticFrontend } from "./plugins/staticFrontend.js";
import { WsGateway } from "./ws/gateway.js";

export async function buildApp(db: Db) {
  const app = Fastify({ logger: { level: config.logLevel } });
  setTasmotaLogger(app.log);
  setTagsLogger(app.log);
  setPrebuiltLogger(app.log);
  const wsGateway = new WsGateway();

  const stateService = new DeviceStateService(db, wsGateway);
  const deviceService = new DeviceService(db, stateService);
  const groupService = new GroupService(db, deviceService);
  const backupService = new BackupService(db, deviceService);
  const ruleService = new RuleService(deviceService);
  const buildQueue = new BuildQueue(db, deviceService, wsGateway);
  const presetService = new PresetService(db);
  const tagService = new TagService();
  const scanService = new ScanService(deviceService, wsGateway);
  const otaService = new OtaService(buildQueue, backupService, wsGateway);
  await buildQueue.init();

  app.register(cors, { origin: config.corsOrigin ?? true });
  app.register(websocket);

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError) {
      return reply.code(400).send({ error: "Validation failed", details: error.flatten() });
    }
    if (error instanceof NotFoundError) return reply.code(404).send({ error: error.message });
    if (error instanceof ConflictError) return reply.code(409).send({ error: error.message });
    if (error instanceof InvalidCidrError) return reply.code(400).send({ error: error.message });
    if (error instanceof TasmotaHttpError) return reply.code(502).send({ error: error.message });
    if (error instanceof OtaVerificationError) return reply.code(502).send({ error: error.message });
    if (error instanceof PrebuiltNotFoundError) return reply.code(404).send({ error: error.message });
    if (error instanceof ConfigurationError) return reply.code(400).send({ error: error.message });
    request.log.error(error);
    return reply.code(500).send({ error: "Internal server error" });
  });

  app.get("/api/health", async () => ({ status: "ok" }));
  app.register(deviceRoutes, { prefix: "/api/devices", devices: deviceService });
  app.register(backupRoutes, { prefix: "/api/devices", backups: backupService });
  app.register(ruleRoutes, { prefix: "/api/devices", rules: ruleService });
  app.register(telemetryRoutes, { prefix: "/api/devices", state: stateService });
  app.register(groupRoutes, { prefix: "/api/groups", groups: groupService });
  app.register(firmwareRoutes, {
    prefix: "/api/firmware",
    builds: buildQueue,
    presets: presetService,
    tags: tagService,
  });
  app.register(networkRoutes, { prefix: "/api/network", scan: scanService });
  app.register(otaRoutes, { prefix: "/api/ota", ota: otaService, builds: buildQueue });

  app.register(async (instance) => wsGateway.register(instance));

  if (config.webDistPath) {
    await registerStaticFrontend(app, config.webDistPath);
  }

  return { app, wsGateway, deviceService, stateService };
}

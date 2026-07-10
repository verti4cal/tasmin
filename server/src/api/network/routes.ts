import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { parseCidrHosts } from "../../infra/network/cidr.js";
import type { ScanService } from "../../domain/devices/scanService.js";

const scanRequestSchema = z.object({ subnet: z.string().min(1).max(50) });

export const networkRoutes: FastifyPluginAsync<{ scan: ScanService }> = async (app, { scan }) => {
  app.get("/scan/status", async () => ({ running: scan.isRunning() }));

  app.post("/scan", async (request, reply) => {
    const { subnet } = scanRequestSchema.parse(request.body);
    const hosts = parseCidrHosts(subnet); // throws InvalidCidrError -> 400 via global handler

    if (scan.isRunning()) {
      return reply.code(409).send({ error: "A scan is already in progress" });
    }

    reply.code(202);
    void scan.scanHosts(hosts); // runs in the background; progress goes out over WS

    return { status: "started", total: hosts.length };
  });
};

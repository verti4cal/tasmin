import type { FastifyInstance } from "fastify";
import type { WebSocket } from "ws";

/**
 * Minimal pub/sub gateway. Device pollers and the firmware build queue
 * (added in later milestones) push events here; every connected client
 * receives them. No per-client subscriptions yet — the payload volume
 * doesn't warrant it at this stage.
 */
export class WsGateway {
  private readonly clients = new Set<WebSocket>();

  register(app: FastifyInstance) {
    app.get("/ws", { websocket: true }, (socket) => {
      this.clients.add(socket);
      socket.on("close", () => this.clients.delete(socket));
    });
  }

  broadcast(event: { type: string; payload: unknown }) {
    const message = JSON.stringify(event);
    for (const client of this.clients) {
      if (client.readyState === client.OPEN) client.send(message);
    }
  }
}

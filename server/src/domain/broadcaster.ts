/** Shared by every domain service that pushes events to connected clients over WS. */
export interface Broadcaster {
  broadcast(event: { type: string; payload: unknown }): void;
}

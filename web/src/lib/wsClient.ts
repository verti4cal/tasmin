export interface WsEvent {
  type: string;
  payload: unknown;
}

type Listener = (event: WsEvent) => void;

const listeners = new Set<Listener>();
let socket: WebSocket | null = null;

function isWsEvent(data: unknown): data is WsEvent {
  return typeof data === "object" && data !== null && typeof (data as { type?: unknown }).type === "string";
}

function ensureSocket(): WebSocket {
  if (socket && socket.readyState <= WebSocket.OPEN) return socket;

  const protocol = window.location.protocol === "https:" ? "wss" : "ws";
  const ws = new WebSocket(`${protocol}://${window.location.host}/ws`);

  ws.onmessage = (event) => {
    try {
      const data: unknown = JSON.parse(event.data);
      if (isWsEvent(data)) {
        for (const listener of listeners) listener(data);
      }
    } catch {
      // ignore malformed messages
    }
  };

  ws.onclose = () => {
    if (socket === ws) socket = null;
  };

  socket = ws;
  return ws;
}

/** All WS consumers share one connection; the socket opens lazily on first subscriber. */
export function subscribeWs(listener: Listener): () => void {
  ensureSocket();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

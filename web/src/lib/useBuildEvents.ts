import { useEffect, useRef } from "react";
import { subscribeWs, type WsEvent } from "./wsClient.js";

export interface BuildLogEvent {
  type: "build.log";
  payload: { buildId: number; line: string };
}

export interface BuildStatusEvent {
  type: "build.status";
  payload: { buildId: number; status: string; error?: string };
}

function isBuildEvent(event: WsEvent): event is BuildLogEvent | BuildStatusEvent {
  return event.type === "build.log" || event.type === "build.status";
}

/** Subscribes to firmware build log/status broadcasts for the lifetime of the component. */
export function useBuildEvents(onEvent: (event: BuildLogEvent | BuildStatusEvent) => void) {
  const handlerRef = useRef(onEvent);
  handlerRef.current = onEvent;

  useEffect(() => {
    return subscribeWs((event) => {
      if (isBuildEvent(event)) handlerRef.current(event);
    });
  }, []);
}

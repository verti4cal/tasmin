import { useEffect, useRef } from "react";
import { subscribeWs, type WsEvent } from "./wsClient.js";

export interface OtaStatusEvent {
  type: "ota.status";
  payload: { status: "started" | "complete"; total?: number };
}

export interface OtaDeviceEvent {
  type: "ota.device";
  payload: { deviceId: number; status: "pushing" | "verifying" | "success" | "failed"; error?: string };
}

type OtaEvent = OtaStatusEvent | OtaDeviceEvent;

function isOtaEvent(event: WsEvent): event is OtaEvent {
  return event.type === "ota.status" || event.type === "ota.device";
}

/** Subscribes to bulk OTA push progress broadcasts for the lifetime of the component. */
export function useOtaEvents(onEvent: (event: OtaEvent) => void) {
  const handlerRef = useRef(onEvent);
  handlerRef.current = onEvent;

  useEffect(() => {
    return subscribeWs((event) => {
      if (isOtaEvent(event)) handlerRef.current(event);
    });
  }, []);
}

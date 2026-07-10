import { useEffect, useRef } from "react";
import { subscribeWs, type WsEvent } from "./wsClient.js";

export interface ScanStatusEvent {
  type: "scan.status";
  payload: { status: "started" | "complete"; total: number; scanned?: number; added?: number };
}

export interface ScanProgressEvent {
  type: "scan.progress";
  payload: { scanned: number; total: number };
}

export interface ScanDeviceEvent {
  type: "scan.device";
  payload: { id: number; name: string; host: string };
}

type ScanEvent = ScanStatusEvent | ScanProgressEvent | ScanDeviceEvent;

function isScanEvent(event: WsEvent): event is ScanEvent {
  return event.type === "scan.status" || event.type === "scan.progress" || event.type === "scan.device";
}

/** Subscribes to subnet-scan progress/discovery broadcasts for the lifetime of the component. */
export function useScanEvents(onEvent: (event: ScanEvent) => void) {
  const handlerRef = useRef(onEvent);
  handlerRef.current = onEvent;

  useEffect(() => {
    return subscribeWs((event) => {
      if (isScanEvent(event)) handlerRef.current(event);
    });
  }, []);
}

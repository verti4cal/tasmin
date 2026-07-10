import { useEffect, useRef } from "react";
import { subscribeWs, type WsEvent } from "./wsClient.js";

export interface DeviceStateEvent {
  type: "device.state";
  payload: { deviceId: number; key: string; value: string; updatedAt: string };
}

function isDeviceStateEvent(event: WsEvent): event is DeviceStateEvent {
  return event.type === "device.state";
}

/** Subscribes to device state broadcasts for the lifetime of the component. */
export function useDeviceEvents(onEvent: (event: DeviceStateEvent) => void) {
  const handlerRef = useRef(onEvent);
  handlerRef.current = onEvent;

  useEffect(() => {
    return subscribeWs((event) => {
      if (isDeviceStateEvent(event)) handlerRef.current(event);
    });
  }, []);
}

import mqtt, { type MqttClient } from "mqtt";
import type { DeviceService } from "../../domain/devices/service.js";
import type { DeviceStateService } from "../../domain/devices/stateService.js";
import type { Logger } from "../logger.js";
import { parseTasmotaPayload } from "../tasmota/payload.js";

const TOPIC_PREFIXES = ["tele", "stat"] as const;

/**
 * Subscribes to every Tasmota device's tele/stat topics and forwards parsed
 * state into DeviceStateService. Devices are matched by their configured
 * `mqttTopic` — devices without one are left to the HTTP poller instead.
 */
export function startMqttListener(
  brokerUrl: string,
  devices: DeviceService,
  state: DeviceStateService,
  logger: Logger,
): MqttClient {
  const client = mqtt.connect(brokerUrl);

  client.on("connect", () => {
    logger.info(`MQTT connected to ${brokerUrl}`);
    for (const prefix of TOPIC_PREFIXES) {
      client.subscribe(`${prefix}/+/+`, (err) => {
        if (err) logger.error(`MQTT subscribe failed for ${prefix}/+/+: ${err.message}`);
      });
    }
  });

  client.on("error", (err) => logger.error(`MQTT error: ${err.message}`));

  client.on("message", (topic, payload) => {
    const [prefix, deviceTopic, ...rest] = topic.split("/");
    if (!TOPIC_PREFIXES.includes(prefix as (typeof TOPIC_PREFIXES)[number]) || rest.length === 0) {
      return;
    }

    const device = devices.findByMqttTopic(deviceTopic!);
    if (!device) return; // message from a device we don't manage

    const entries = parseTasmotaPayload(rest.join("/"), payload.toString());
    for (const [key, value] of Object.entries(entries)) {
      state.record(device.id, key, value);
    }
  });

  return client;
}

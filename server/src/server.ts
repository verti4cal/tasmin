import { buildApp } from "./app.js";
import { config } from "./config.js";
import { db } from "./infra/db/client.js";
import { startMqttListener } from "./infra/mqtt/client.js";
import { startHttpPoller } from "./infra/tasmota/poller.js";

const { app, deviceService, stateService } = await buildApp(db);

startHttpPoller(deviceService, stateService, config.devicePollIntervalMs, app.log);

if (config.mqttUrl) {
  startMqttListener(config.mqttUrl, deviceService, stateService, app.log);
} else {
  app.log.info("MQTT_URL not set — all devices will be managed via HTTP polling only");
}

const pruneTelemetry = () => stateService.pruneOlderThan(config.telemetryRetentionDays);
pruneTelemetry();
setInterval(pruneTelemetry, 60 * 60 * 1000).unref();

app.listen({ port: config.port, host: "0.0.0.0" }).catch((error) => {
  app.log.error(error);
  process.exit(1);
});

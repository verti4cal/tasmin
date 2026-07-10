import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Overridable so the dev Docker Compose stack can point the web container
// at the server container by service name (http://server:3000) instead of
// localhost, which inside a container would mean "this container".
const apiTarget = process.env.VITE_DEV_API_TARGET ?? "http://localhost:3000";

export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // bind 0.0.0.0 so the dev server is reachable from outside a container
    proxy: {
      "/api": apiTarget,
      "/ws": { target: apiTarget.replace(/^http/, "ws"), ws: true },
    },
  },
});

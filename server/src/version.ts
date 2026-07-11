import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

// version.json lives at the repo root. Its position relative to this file
// differs between dev (tsx running server/src/version.ts directly, so the
// repo root is two levels up) and the production Docker image (compiled to
// /app/dist/version.js, with version.json copied to /app/version.json,
// one level up) — try both rather than assuming either layout.
const candidates = [join(here, "../version.json"), join(here, "../../version.json")];
const versionFile = candidates.find(existsSync);

export const appVersion: string = versionFile
  ? (JSON.parse(readFileSync(versionFile, "utf8")) as { version: string }).version
  : "unknown";

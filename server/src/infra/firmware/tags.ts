import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { config } from "../../config.js";
import type { Logger } from "../logger.js";

const execFileAsync = promisify(execFile);

const CACHE_TTL_MS = 60 * 60 * 1000; // tags don't change often — an hour is plenty fresh

let cache: { tags: string[]; fetchedAt: number } | null = null;
let logger: Logger = console;

export function setTagsLogger(l: Logger): void {
  logger = l;
}

/**
 * Lists Tasmota release tags from the configured repo via `git ls-remote`
 * — no GitHub API rate limits, and reuses the same `git` binary the
 * firmware compiler already requires. Resilient to failure: on error it
 * logs a warning and falls back to the last successful result (or an
 * empty list) rather than breaking the build form.
 */
export async function listTasmotaTags({ forceRefresh = false } = {}): Promise<string[]> {
  if (!forceRefresh && cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.tags;
  }

  try {
    const { stdout } = await execFileAsync(
      config.gitCommand,
      ["ls-remote", "--tags", "--refs", config.tasmotaRepoUrl],
      { timeout: 10_000 },
    );
    const tags = parseTagRefs(stdout).sort(compareVersionsDescending);
    cache = { tags, fetchedAt: Date.now() };
    return tags;
  } catch (error) {
    logger.warn(`Failed to list Tasmota tags from ${config.tasmotaRepoUrl}: ${String(error)}`);
    return cache?.tags ?? [];
  }
}

export function parseTagRefs(lsRemoteOutput: string): string[] {
  return lsRemoteOutput
    .split("\n")
    .map((line) => line.split("refs/tags/")[1])
    .filter((tag): tag is string => Boolean(tag));
}

/** Sorts version tags newest-first (e.g. "v13.4.0" before "v9.5.0"), handling Tasmota's occasional 4-part versions. */
export function compareVersionsDescending(a: string, b: string): number {
  const parts = (tag: string) => tag.replace(/^v/, "").split(".").map((n) => Number(n) || 0);
  const [aParts, bParts] = [parts(a), parts(b)];

  for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
    const diff = (bParts[i] ?? 0) - (aParts[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

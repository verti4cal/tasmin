import { config } from "../../config.js";
import type { Logger } from "../logger.js";

export interface PrebuiltAsset {
  variant: string;
  sizeBytes: number;
  downloadUrl: string;
}

export class PrebuiltNotFoundError extends Error {}

const CACHE_TTL_MS = 60 * 60 * 1000; // releases don't change once published — an hour is plenty fresh

const cache = new Map<string, { assets: PrebuiltAsset[]; fetchedAt: number }>();
let logger: Logger = console;

export function setPrebuiltLogger(l: Logger): void {
  logger = l;
}

const LANGUAGE_VARIANT = /-[A-Z]{2}$/;

/**
 * Keeps only the "feature variant" binaries meant for OTA upload — drops
 * .bin.gz (compressed OTA-only images our /u2 push doesn't handle), the
 * ESP32 .factory.bin full-flash images and -safeboot.bin bootloader
 * helpers (neither is a normal OTA payload), and per-language rebuilds.
 */
export function isFeatureVariant(assetName: string): boolean {
  if (!assetName.endsWith(".bin")) return false;
  if (assetName.endsWith(".factory.bin")) return false;
  if (assetName.endsWith("-safeboot.bin")) return false;
  const variant = assetName.slice(0, -".bin".length);
  return !LANGUAGE_VARIANT.test(variant);
}

export function parseGitHubOwnerRepo(repoUrl: string): { owner: string; repo: string } {
  const url = new URL(repoUrl.replace(/\.git$/, ""));
  const [, owner, repo] = url.pathname.split("/");
  if (!owner || !repo) {
    throw new Error(`Cannot parse a GitHub owner/repo out of "${repoUrl}"`);
  }
  return { owner, repo };
}

/**
 * Lists official prebuilt firmware variants for a released version tag,
 * straight from that GitHub release's assets — no local compile needed.
 * Only tagged releases have prebuilt binaries; "master" (or any non-release
 * ref) will 404.
 */
export async function listPrebuiltAssets(version: string): Promise<PrebuiltAsset[]> {
  const cached = cache.get(version);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.assets;
  }

  const { owner, repo } = parseGitHubOwnerRepo(config.tasmotaRepoUrl);
  const url = `https://api.github.com/repos/${owner}/${repo}/releases/tags/${version}`;

  let response: Response;
  try {
    response = await fetch(url, { headers: { Accept: "application/vnd.github+json" } });
  } catch (error) {
    logger.warn(`Failed to reach GitHub releases API for ${version}: ${String(error)}`);
    return cached?.assets ?? [];
  }

  if (response.status === 404) {
    throw new PrebuiltNotFoundError(
      `No GitHub release found for "${version}" — prebuilt binaries only exist for tagged releases`,
    );
  }
  if (!response.ok) {
    logger.warn(`GitHub releases API returned HTTP ${response.status} for ${version}`);
    return cached?.assets ?? [];
  }

  const body = (await response.json()) as {
    assets: { name: string; size: number; browser_download_url: string }[];
  };

  const assets = body.assets
    .filter((asset) => isFeatureVariant(asset.name))
    .map((asset) => ({
      variant: asset.name.slice(0, -".bin".length),
      sizeBytes: asset.size,
      downloadUrl: asset.browser_download_url,
    }))
    .sort((a, b) => a.variant.localeCompare(b.variant));

  cache.set(version, { assets, fetchedAt: Date.now() });
  return assets;
}

export async function downloadPrebuiltAsset(
  version: string,
  variant: string,
): Promise<{ data: Buffer; filename: string }> {
  const assets = await listPrebuiltAssets(version);
  const asset = assets.find((a) => a.variant === variant);
  if (!asset) {
    throw new PrebuiltNotFoundError(`"${variant}" is not an available prebuilt variant for ${version}`);
  }

  logger.info(`Prebuilt firmware request: GET ${asset.downloadUrl}`);
  const response = await fetch(asset.downloadUrl);
  if (!response.ok) {
    throw new Error(`Failed to download ${asset.downloadUrl}: HTTP ${response.status}`);
  }
  const data = Buffer.from(await response.arrayBuffer());
  logger.info(`Prebuilt firmware response: GET ${asset.downloadUrl} -> ${data.byteLength} bytes`);
  return { data, filename: `${variant}.bin` };
}

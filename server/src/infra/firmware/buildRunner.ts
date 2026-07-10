import { spawn } from "node:child_process";
import { access, mkdir, rmdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { config } from "../../config.js";

export interface BuildRunnerOptions {
  baseVersion: string;
  env: string;
  overrides: string;
  buildFlags: string;
  onLogLine: (line: string) => void;
}

export interface BuildRunnerResult {
  binaryPath: string;
}

export class BuildFailedError extends Error {}

/**
 * Prepares a Tasmota checkout at `config.tasmotaSrcDir` (cloning once, then
 * fetching/checking out the requested ref on each build so we don't re-clone
 * every time), writes the user's overrides into user_config_override.h, and
 * invokes PlatformIO to compile the given environment.
 *
 * Both steps shell out to configurable commands (GIT_COMMAND / PIO_COMMAND)
 * so this can be pointed at a stub toolchain in tests without touching this
 * logic — the real thing is a multi-hundred-MB, multi-minute operation.
 */
export async function runBuild(options: BuildRunnerOptions): Promise<BuildRunnerResult> {
  const { baseVersion, env, overrides, buildFlags, onLogLine } = options;
  const srcDir = config.tasmotaSrcDir;

  await prepareSource(srcDir, baseVersion, onLogLine);
  await writeOverrides(srcDir, overrides);
  await writeBuildFlags(srcDir, buildFlags);
  await compile(srcDir, env, onLogLine);

  return { binaryPath: await locateBinary(srcDir, env) };
}

/**
 * Exported for testing: always wipes any existing checkout before cloning
 * fresh. PlatformIO's pre-build scripts (and pio itself) can leave untracked
 * or modified files in the working tree after a build (e.g. generated
 * Berry/Matter sources) that block a plain `checkout` on the next build
 * ("would be removed by checkout") — starting from nothing every time
 * sidesteps that entirely, at the cost of a full re-clone per build.
 */
export async function prepareSource(srcDir: string, ref: string, onLogLine: (line: string) => void) {
  if (await pathExists(path.resolve(srcDir))) {
    await rmdir(srcDir, { recursive: true });
  }

  await mkdir(path.dirname(path.resolve(srcDir)), { recursive: true });

  if (!(await pathExists(path.join(srcDir, ".git")))) {
    await run(
      config.gitCommand,
      ["clone", "--depth", "1", config.tasmotaRepoUrl, srcDir],
      onLogLine,
    );
  }
  await run(config.gitCommand, ["fetch", "--depth", "1", "origin", ref], onLogLine, srcDir);
  await run(config.gitCommand, ["checkout", "FETCH_HEAD"], onLogLine, srcDir);
}

async function writeOverrides(srcDir: string, overrides: string) {
  const overridePath = path.join(srcDir, "tasmota", "user_config_override.h");
  const contents = `#ifndef _USER_CONFIG_OVERRIDE_H_\n#define _USER_CONFIG_OVERRIDE_H_\n\n${overrides}\n\n#endif\n`;
  await writeFile(overridePath, contents, "utf8");
}

/**
 * PlatformIO's build_flags for a custom compile go into platformio_override.ini
 * at the repo root — platformio.ini lists it in `extra_configs`, and the
 * `[tasmota]` section's `build_flags` is interpolated first thing into
 * `[esp_defaults].build_flags` (which every environment inherits from), so
 * this is purely additive and can't clobber Tasmota's own required flags.
 * Always (re)written, including when empty, so a previous build's flags
 * don't leak into one that didn't ask for any.
 */
async function writeBuildFlags(srcDir: string, buildFlags: string) {
  const overridePath = path.join(srcDir, "platformio_override.ini");
  const flags = buildFlags.trim();
  const contents = flags ? `[tasmota]\nbuild_flags = ${flags}\n` : "";
  await writeFile(overridePath, contents, "utf8");
}

async function compile(srcDir: string, env: string, onLogLine: (line: string) => void) {
  await run(config.pioCommand, ["run", "-e", env], onLogLine, srcDir);
}

async function locateBinary(srcDir: string, env: string): Promise<string> {
  for (const name of ["firmware.bin", "firmware.factory.bin"]) {
    const candidate = path.join(srcDir, ".pio", "build", env, name);
    if (await pathExists(candidate)) return candidate;
  }
  throw new BuildFailedError(`No firmware binary found for env "${env}" after build`);
}

async function pathExists(target: string): Promise<boolean> {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}

function run(command: string, args: string[], onLogLine: (line: string) => void, cwd?: string) {
  return new Promise<void>((resolve, reject) => {
    onLogLine(`$ ${command} ${args.join(" ")}`);
    const child = spawn(command, args, { cwd });

    const forward = (chunk: Buffer) => {
      for (const line of chunk.toString("utf8").split(/\r?\n/)) {
        if (line.length > 0) onLogLine(line);
      }
    };

    child.stdout.on("data", forward);
    child.stderr.on("data", forward);
    child.on("error", (err) =>
      reject(new BuildFailedError(`Failed to run ${command}: ${err.message}`)),
    );
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new BuildFailedError(`${command} ${args.join(" ")} exited with code ${code}`));
    });
  });
}

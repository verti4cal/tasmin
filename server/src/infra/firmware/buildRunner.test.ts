import { EventEmitter } from "node:events";
import { beforeEach, describe, expect, it, vi } from "vitest";

interface RecordedCommand {
  command: string;
  args: string[];
  cwd?: string;
}

const commands: RecordedCommand[] = [];
const removedPaths: string[] = [];
let gitDirExists = false;
let srcDirExists = true;

vi.mock("node:child_process", () => ({
  spawn: vi.fn((command: string, args: string[], options?: { cwd?: string }) => {
    commands.push({ command, args, cwd: options?.cwd });
    const child = new EventEmitter() as EventEmitter & { stdout: EventEmitter; stderr: EventEmitter };
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    queueMicrotask(() => child.emit("close", 0));
    return child;
  }),
}));

vi.mock("node:fs/promises", () => ({
  access: vi.fn(async (target: string) => {
    if (String(target).endsWith(".git")) {
      if (gitDirExists) return undefined;
      throw new Error("ENOENT");
    }
    if (srcDirExists) return undefined;
    throw new Error("ENOENT");
  }),
  mkdir: vi.fn(async () => undefined),
  rmdir: vi.fn(async (target: string) => {
    removedPaths.push(String(target));
    // a real rmdir takes .git down with it — reflect that in the mock so
    // the subsequent "does .git exist?" check behaves like the real thing
    srcDirExists = false;
    gitDirExists = false;
  }),
  writeFile: vi.fn(async () => undefined),
}));

const { prepareSource } = await import("./buildRunner.js");

describe("prepareSource", () => {
  beforeEach(() => {
    commands.length = 0;
    removedPaths.length = 0;
    gitDirExists = false;
    srcDirExists = true;
  });

  it("wipes the existing checkout before doing anything else", async () => {
    await prepareSource("/data/tasmota-src", "v13.4.0", () => {});

    expect(removedPaths).toEqual(["/data/tasmota-src"]);
  });

  it("doesn't try to remove anything on the very first build (nothing there yet)", async () => {
    srcDirExists = false;

    await prepareSource("/data/tasmota-src", "v13.4.0", () => {});

    expect(removedPaths).toEqual([]);
    expect(commands.map((c) => c.args[0])).toEqual(["clone", "fetch", "checkout"]);
  });

  it("clones fresh, then fetches and checks out the requested ref, in order", async () => {
    await prepareSource("/data/tasmota-src", "v13.4.0", () => {});

    const gitCommandNames = commands.map((c) => c.args[0]);
    expect(gitCommandNames).toEqual(["clone", "fetch", "checkout"]);
  });

  it("always clones after wiping, even if a .git dir was present beforehand", async () => {
    gitDirExists = true;

    await prepareSource("/data/tasmota-src", "v13.4.0", () => {});

    // the directory is removed first, so the later ".git exists?" check must
    // see a clean slate and clone regardless of gitDirExists
    expect(removedPaths).toEqual(["/data/tasmota-src"]);
    expect(commands.map((c) => c.args[0])).toEqual(["clone", "fetch", "checkout"]);
  });

  it("fetches the exact ref requested and checks out FETCH_HEAD", async () => {
    await prepareSource("/data/tasmota-src", "v13.4.0", () => {});

    const fetchCommand = commands.find((c) => c.args[0] === "fetch");
    const checkoutCommand = commands.find((c) => c.args[0] === "checkout");

    expect(fetchCommand?.args).toEqual(["fetch", "--depth", "1", "origin", "v13.4.0"]);
    expect(checkoutCommand?.args).toEqual(["checkout", "FETCH_HEAD"]);
  });
});

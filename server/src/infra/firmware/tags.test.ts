import { describe, expect, it } from "vitest";
import { compareVersionsDescending, parseTagRefs } from "./tags.js";

describe("parseTagRefs", () => {
  it("extracts tag names from git ls-remote output", () => {
    const output = [
      "5b3d673deaafae0099b644b79327a2b48131bcde\trefs/tags/v8.3.1",
      "b59a8a7966b7bb55e2b6d41a14e1ef66cd4667c4\trefs/tags/v8.4.0",
      "",
    ].join("\n");

    expect(parseTagRefs(output)).toEqual(["v8.3.1", "v8.4.0"]);
  });

  it("returns an empty array for empty output", () => {
    expect(parseTagRefs("")).toEqual([]);
  });
});

describe("compareVersionsDescending", () => {
  it("sorts standard three-part versions newest first", () => {
    expect(["v9.5.0", "v13.4.0", "v12.1.0"].sort(compareVersionsDescending)).toEqual([
      "v13.4.0",
      "v12.1.0",
      "v9.5.0",
    ]);
  });

  it("handles Tasmota's occasional 4-part versions", () => {
    expect(["v9.1.0", "v9.1.0.2", "v9.1.0.1"].sort(compareVersionsDescending)).toEqual([
      "v9.1.0.2",
      "v9.1.0.1",
      "v9.1.0",
    ]);
  });
});

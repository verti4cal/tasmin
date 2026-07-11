import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Restrict to TS sources — without this, vitest's default glob also
    // matches compiled *.test.js under dist/ if a stale build exists,
    // running duplicate/broken copies with wrong relative paths.
    include: ["src/**/*.test.ts"],
  },
});

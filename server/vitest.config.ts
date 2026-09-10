import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Pure-logic unit tests only — no DB, no server. Files live next to the
    // code they cover as *.test.ts.
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});

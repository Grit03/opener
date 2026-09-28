import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "native-host",
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});

import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
      // « server-only » refuse d'être importé hors de Next.js : on le neutralise pour les tests.
      "server-only": path.resolve(__dirname, "lib/tests/server-only.ts"),
    },
  },
  test: { include: ["lib/**/*.test.ts"] },
});

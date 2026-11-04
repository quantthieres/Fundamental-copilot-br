import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
  },
  // tsconfig keeps "jsx": "preserve" for Next.js; component tests
  // (*.test.tsx, server-rendered with react-dom/server) need a real transform.
  oxc: {
    jsx: { runtime: "automatic" },
  },
  resolve: {
    alias: {
      "@": path.resolve("./src"),
    },
  },
});

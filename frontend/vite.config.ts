import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
  },
  test: {
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      all: true,
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        // shadcn/ui generated components — third-party generated code, no meaningful branching to test
        "src/components/ui/**",
        // ambient type declarations only
        "src/vite-env.d.ts",
        // type-only modules with no executable statements
        "src/features/types.ts",
        "src/features/app/types.ts",
      ],
      thresholds: {
        lines: 80,
        statements: 80,
      },
    },
  },
});

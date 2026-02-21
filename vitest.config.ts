import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@smart-tool/browser-native-llm": path.resolve(__dirname, "./browser-native-llm/src/index.ts"),
      "@smart-tool/lengua-materna": path.resolve(__dirname, "./browser-translation/src/index.ts"),
      "@smart-tool/puente-engine": path.resolve(__dirname, "./puente-engine/src/index.ts"),
    },
  },
});

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// NOTE: for GitHub Pages, set base: '/<repo-name>/'.
export default defineConfig({
  plugins: [react()],
  base: "./",
  build: {
    target: "es2018",
    cssCodeSplit: true,
    // Keep legacy app chunked separately for better caching + faster boot on repeat visits.
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id) return;
          if (id.includes("node_modules")) {
            if (id.includes("react") || id.includes("react-dom")) return "react-vendor";
            return "vendor";
          }
          if (id.includes("/src/legacy/")) return "legacy";
        },
      },
    },
  },
});

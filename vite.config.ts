import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  root: "src",
  plugins: [react()],
  base: "./",
  server: {
    port: 5173,
    strictPort: true,
  },
  build: {
    outDir: "../dist",
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (id.includes("mermaid")) return "mermaid";
            if (id.includes("cytoscape")) return "cytoscape";
            if (id.includes("katex")) return "katex";
            if (id.includes("shiki") || id.includes("highlight.js"))
              return "syntax";
          }
        },
      },
    },
    chunkSizeWarningLimit: 900,
  },
});

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  root: "src",
  // @ts-ignore - Type conflict when multiple Vite projects are open in workspace
  plugins: [react()],
  base: "./",
  server: {
    port: 5173,
<<<<<<< HEAD
    strictPort: false,
=======
    strictPort: true,
>>>>>>> f1d3a2dd6f5a94e4a34ac0cc814a923dee7644e7
  },
  build: {
    outDir: "../dist",
  },
});

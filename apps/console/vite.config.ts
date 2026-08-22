import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// The console is served by the API under /console (D34). In dev, Vite proxies the API so the
// same-origin cookie and fetch paths work exactly as they do in production.
export default defineConfig({
  base: "/console/",
  plugins: [react()],
  build: { outDir: "dist", emptyOutDir: true },
  server: {
    port: 5173,
    proxy: {
      "/console-api": "http://127.0.0.1:4000",
      "/tracks": "http://127.0.0.1:4000",
    },
  },
});

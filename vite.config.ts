import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: "/solana-test-dapp/",
  define: {
    "process.env": {},
    global: {},
  },
  resolve: {
    alias: {
      buffer: "buffer/",
    },
  },
  optimizeDeps: {
    include: ["buffer"],
  },
  build: {
    rollupOptions: {
      plugins: [],
    },
  },
  server: {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
    },
    hmr: {
      overlay: true,
    },
    watch: {
      usePolling: true,
    },
    cors: true,
    strictPort: true,
    host: true,
  },
  logLevel: "info",
});

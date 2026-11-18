import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 4747,
    strictPort: true,
    host: "127.0.0.1",
    // In development the agent runs on 4748; the UI (and the extension) talk to 4747.
    proxy: { "/api": { target: "http://127.0.0.1:4748", changeOrigin: false } },
  },
  preview: { port: 4747, strictPort: true, host: "127.0.0.1" },
});

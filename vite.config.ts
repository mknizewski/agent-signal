import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

export default defineConfig({
  base: "./",
  plugins: [react()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        desktop: resolve(__dirname, "index.html"),
        mobile: resolve(__dirname, "mobile.html")
      }
    }
  },
  server: {
    strictPort: true,
    port: 5173
  }
});

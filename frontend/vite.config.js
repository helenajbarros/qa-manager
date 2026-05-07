import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  // GitHub Pages usa /qa-manager/, VPS usa /
  base: process.env.VITE_BASE_PATH || (mode === "production" && !process.env.VITE_API_URL ? "/qa-manager/" : "/"),
  server: {
    port: 5173,
    proxy: {
      "/api":     { target: "http://localhost:3001", changeOrigin: true },
      "/uploads": { target: "http://localhost:3001", changeOrigin: true },
    },
  },
}));

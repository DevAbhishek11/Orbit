import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import babel from "@rolldown/plugin-babel";
import { VitePWA } from "vite-plugin-pwa";
import { defineConfig } from "vite";

const API_TARGET = process.env.ORBIT_API_URL ?? "http://127.0.0.1:8010";

const proxy = {
  "/api": {
    target: API_TARGET,
    changeOrigin: true,
    headers: { origin: "http://localhost:5173" },
  },
  "/health": {
    target: API_TARGET,
    changeOrigin: true,
    headers: { origin: "http://localhost:5173" },
  },
  "/metrics": {
    target: API_TARGET,
    changeOrigin: true,
    headers: { origin: "http://localhost:5173" },
  },
  "/socket.io": { target: API_TARGET, ws: true, changeOrigin: true },
};

export default defineConfig({
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg"],
      manifest: {
        name: "Orbit",
        short_name: "Orbit",
        description: "Orbit — collaborative workspace",
        theme_color: "#111827",
        background_color: "#ffffff",
        display: "standalone",
        icons: [
          { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
        ],
      },
      workbox: {
        runtimeCaching: [
          {
            urlPattern: /^\/api\/.*/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "orbit-api-cache",
              networkTimeoutSeconds: 5,
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  server: {
    host: "0.0.0.0",
    port: 5173,
    allowedHosts: true,
    proxy,
  },
  preview: {
    host: "0.0.0.0",
    port: 4173,
    allowedHosts: true,
    proxy,
  },
});

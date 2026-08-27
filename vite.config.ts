import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: { host: "0.0.0.0", port: 3060 },
  // sdk/ is its own package with its own vitest run (`npm --prefix sdk test`) — exclude it here
  // so it isn't picked up twice.
  test: { environment: "node", exclude: ["**/node_modules/**", "sdk/**"] },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ["react", "react-dom", "react-router-dom"],
          supabase: ["@supabase/supabase-js"],
        },
      },
    },
  },
});

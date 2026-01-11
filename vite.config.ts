import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const devApiTarget = env.VITE_DEV_API_URL || env.VITE_API_URL || "http://127.0.0.1:3000";

  return {
    server: {
      host: "::",
      port: 8080,
      proxy: {
        "/api": {
          target: devApiTarget,
          changeOrigin: true,
        },
        "/uploads": {
          target: devApiTarget,
          changeOrigin: true,
        },
      },
    },
    plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});

import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const backendProxyTarget = env.VITE_BACKEND_PROXY_TARGET || "http://127.0.0.1:8000";

  return {
    cacheDir: path.resolve(__dirname, "../../node_modules/.vite/apps-web"),
    server: {
      host: "::",
      port: 8080,
      hmr: {
        overlay: false,
      },
      proxy: {
        "/api/v2": {
          target: backendProxyTarget,
          changeOrigin: true,
        },
      },
    },
    plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
    optimizeDeps: {
      force: mode === "development",
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
        "@kidario/shared": path.resolve(__dirname, "../../packages/shared/src"),
      },
    },
  };
});

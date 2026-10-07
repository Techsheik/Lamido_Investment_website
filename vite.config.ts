import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

function apiDevServerPlugin() {
  return {
    name: "api-dev-server",
    configureServer(server: any) {
      server.middlewares.use(async (req: any, res: any, next: any) => {
        const url = req.url || "";
        if (!url.startsWith("/api")) {
          return next();
        }

        try {
          const apiModule = await import("./api/index.js");
          const handler = apiModule.default;

          if (req.method === "POST" || req.method === "PUT" || req.method === "PATCH") {
            let body = "";
            for await (const chunk of req) {
              body += chunk;
            }
            try {
              req.body = body ? JSON.parse(body) : {};
            } catch {
              req.body = {};
            }
          }

          let responded = false;
          res.status = function (code: number) {
            res.statusCode = code;
            return res;
          };
          res.json = function (data: any) {
            if (responded) return;
            responded = true;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify(data));
          };
          res.send = function (data: any) {
            if (responded) return;
            responded = true;
            res.end(data);
          };

          await handler(req, res);
        } catch (err: any) {
          console.error("[Vite API Middleware Error]:", err);
          if (!res.writableEnded) {
            res.statusCode = 500;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: err.message || "Internal server error" }));
          }
        }
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  Object.assign(process.env, env);

  return {
    server: {
      host: "::",
      port: 8080,
    },
    plugins: [
      react(),
      apiDevServerPlugin(),
      mode === "development" && componentTagger()
    ].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});

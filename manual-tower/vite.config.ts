import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

const mockWords = {
  "Стоматология": 12, "Имплантация": 10, "Vatech": 9,
  "Диагностика": 8, "Рентген": 7, "Инновации": 7,
  "Здоровье": 6, "Корея": 6, "Технологии": 5,
  "Пациент": 5, "Лечение": 4, "Клиника": 4,
  "Снимок": 4, "Точность": 3, "Качество": 3,
  "КЛКТ": 3, "Цифровой": 3, "Забота": 2,
  "Сеул": 2, "Панорама": 2, "Датчик": 2,
  "Сенсор": 1, "Решение": 1, "Детектор": 1,
};

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const useMockApi = env.VITE_MOCK_API === "1";

  return {
    server: {
      host: "::",
      port: 8080,
      hmr: {
        overlay: false,
      },
      proxy: {
        "/api": {
          target: "http://localhost:20222",
          changeOrigin: true,
        },
      },
      middlewareMode: false,
    },
    plugins: [
      react(),
      ...(useMockApi
        ? [
            {
              name: "mock-api",
              configureServer(server) {
                server.middlewares.use("/api/words/approved", (_req, res) => {
                  res.setHeader("Content-Type", "application/json");
                  res.end(JSON.stringify(mockWords));
                });
              },
            },
          ]
        : []),
    ],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});

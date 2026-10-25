import { app } from "./app.js";
import { env } from "./config/env.js";

const server = app.listen(env.PORT, env.HOST, () => {
  console.log(`[Kolben ERP] Servidor iniciado en http://${env.HOST}:${env.PORT}`);
  console.log(`[Kolben ERP] Modo: ${env.NODE_ENV}`);
});

process.on("SIGTERM", () => {
  console.log("[Kolben ERP] Señal SIGTERM recibida, cerrando servidor...");
  server.close(() => {
    console.log("[Kolben ERP] Servidor cerrado limpiamente.");
    process.exit(0);
  });
});

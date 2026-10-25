import express, { Request, Response } from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import { env } from "./config/env.js";
import { authRouter } from "./modules/auth/auth.routes.js";
import { configRouter } from "./modules/config/config.routes.js";
import { requireAuth } from "./middlewares/auth.js";
import { errorHandler } from "./middlewares/error.js";

export const app = express();

// Middlewares base
app.use(helmet());
app.use(cookieParser());
app.use(express.json());

// En local permitimos origen de Vite con credenciales
if (env.NODE_ENV === "development") {
  app.use(
    cors({
      origin: env.APP_URL,
      credentials: true,
    })
  );
}

// Endpoint de verificación de salud
app.get("/api/health", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    app: "Kolben ERP Backend",
    env: env.NODE_ENV,
    timestamp: new Date().toISOString(),
  });
});

// Rutas públicas de autenticación
app.use("/api/auth", authRouter);

// Rutas protegidas
app.use("/api/config", requireAuth, configRouter);

// Manejo global de errores
app.use(errorHandler);

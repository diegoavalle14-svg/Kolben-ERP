import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    return res.status(400).json({ error: "Datos inválidos", detalles: err.flatten() });
  }
  if (
    err instanceof Error &&
    "status" in err &&
    typeof (err as { status: unknown }).status === "number"
  ) {
    return res.status((err as { status: number }).status).json({ error: err.message });
  }
  console.error(err);
  return res.status(500).json({ error: "Error interno del servidor" });
}

import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

export interface AuthPayload {
  sub: number;
  usuario: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.[env.COOKIE_NAME];
  if (!token) return res.status(401).json({ error: "No autenticado" });
  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as unknown as AuthPayload;
    req.user = { sub: Number(payload.sub), usuario: payload.usuario };
    next();
  } catch {
    return res.status(401).json({ error: "Sesión inválida o expirada" });
  }
}

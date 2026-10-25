import { Router, Request, Response, NextFunction } from "express";
import bcrypt from "bcrypt";
import jwt, { SignOptions } from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { env } from "../../config/env.js";
import { requireAuth } from "../../middlewares/auth.js";

export const authRouter = Router();

const credSchema = z.object({
  usuario: z.string().trim().min(3, "Usuario mínimo 3 caracteres"),
  password: z.string().min(8, "Contraseña mínimo 8 caracteres"),
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiados intentos. Intenta de nuevo en 15 minutos." },
});

function setSessionCookie(res: Response, id: number, usuario: string) {
  const token = jwt.sign({ sub: id, usuario }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as SignOptions["expiresIn"],
  });
  res.cookie(env.COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.COOKIE_SECURE,
    path: "/",
    maxAge: 8 * 60 * 60 * 1000,
  });
}

const wrap =
  (fn: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) =>
    fn(req, res).catch(next);

// ¿Existe ya un usuario? (para mostrar pantalla de primer uso)
authRouter.get(
  "/estado",
  wrap(async (_req, res) => {
    const total = await prisma.usuario.count();
    res.json({ requiereSetup: total === 0 });
  })
);

// Creación del usuario en primer uso (solo si no existe ninguno)
authRouter.post(
  "/setup",
  wrap(async (req, res) => {
    const total = await prisma.usuario.count();
    if (total > 0) return res.status(409).json({ error: "El usuario ya fue creado" });
    const { usuario, password } = credSchema.parse(req.body);
    const passwordHash = await bcrypt.hash(password, 12);
    const u = await prisma.usuario.create({ data: { usuario, passwordHash } });
    setSessionCookie(res, u.id, u.usuario);
    res.status(201).json({ usuario: u.usuario });
  })
);

authRouter.post(
  "/login",
  loginLimiter,
  wrap(async (req, res) => {
    const { usuario, password } = credSchema.parse(req.body);
    const u = await prisma.usuario.findUnique({ where: { usuario } });
    const ok = u ? await bcrypt.compare(password, u.passwordHash) : false;
    if (!u || !ok) return res.status(401).json({ error: "Usuario o contraseña incorrectos" });
    setSessionCookie(res, u.id, u.usuario);
    res.json({ usuario: u.usuario });
  })
);

authRouter.post("/logout", (_req, res) => {
  res.clearCookie(env.COOKIE_NAME, { path: "/" });
  res.json({ ok: true });
});

authRouter.get(
  "/me",
  requireAuth,
  wrap(async (req, res) => {
    const user = await prisma.usuario.findUnique({
      where: { id: req.user!.sub },
      select: { usuario: true, passwordHash: true },
    });
    res.json({ usuario: user?.usuario, passwordHash: user?.passwordHash });
  })
);

const cambioSchema = z.object({
  usuario: z.string().trim().min(3, "Usuario mínimo 3 caracteres"),
  passwordActual: z.string().min(1, "Ingresa tu contraseña actual"),
  nueva: z
    .string()
    .transform((val) => val.trim())
    .refine((val) => val === "" || val.length >= 8, {
      message: "La nueva contraseña debe tener mínimo 8 caracteres",
    })
    .optional(),
});

// Cambiar usuario y/o contraseña (requiere la contraseña actual)
authRouter.put(
  "/password",
  requireAuth,
  wrap(async (req, res) => {
    const { usuario, passwordActual, nueva } = cambioSchema.parse(req.body);
    const actual = await prisma.usuario.findUnique({ where: { id: req.user!.sub } });
    if (!actual || !(await bcrypt.compare(passwordActual, actual.passwordHash))) {
      return res.status(401).json({ error: "La contraseña actual es incorrecta" });
    }
    if (usuario !== actual.usuario) {
      const existe = await prisma.usuario.findUnique({ where: { usuario } });
      if (existe) return res.status(409).json({ error: "Ese usuario ya existe" });
    }
    const u = await prisma.usuario.update({
      where: { id: actual.id },
      data: { usuario, ...(nueva ? { passwordHash: await bcrypt.hash(nueva, 12) } : {}) },
      select: { usuario: true, passwordHash: true },
    });
    setSessionCookie(res, u.id, u.usuario);
    res.json({ usuario: u.usuario, passwordHash: u.passwordHash });
  })
);

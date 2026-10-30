import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";

export const configRouter = Router();

const wrap =
  (fn: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) =>
    fn(req, res).catch(next);

const configSchema = z.object({
  vendedor: z.string().trim().min(1),
  contacto: z.string().trim().min(1),
  titularCheques: z.string().trim().nullable().optional(),
  porcentajeIsv: z.coerce.number().min(0).max(100),
  correoRespaldo: z.string().email().nullable().optional().or(z.literal("")),
  diaRespaldo: z.coerce.number().int().min(1).max(7),
  portadaPath: z.string().trim().nullable().optional(),
  paletaCatalogo: z.string().trim().optional(),
});

const bancoSchema = z.object({
  nombre: z.string().trim().min(1),
  cuentaEnmascarada: z.string().trim().min(1),
});

configRouter.get(
  "/",
  wrap(async (_req, res) => {
    const config =
      (await prisma.configuracion.findUnique({ where: { id: 1 } })) ??
      (await prisma.configuracion.create({ data: { id: 1, vendedor: "", contacto: "" } }));
    const bancos = await prisma.banco.findMany({ orderBy: { orden: "asc" } });
    res.json({ config, bancos });
  })
);

configRouter.put(
  "/",
  wrap(async (req, res) => {
    const data = configSchema.parse(req.body);
    const payload = { ...data, correoRespaldo: data.correoRespaldo || null };
    const config = await prisma.configuracion.upsert({
      where: { id: 1 },
      update: payload,
      create: { id: 1, ...payload },
    });
    res.json({ config });
  })
);

configRouter.post(
  "/bancos",
  wrap(async (req, res) => {
    const data = bancoSchema.parse(req.body);
    const max = await prisma.banco.aggregate({ _max: { orden: true } });
    const banco = await prisma.banco.create({ data: { ...data, orden: (max._max.orden ?? 0) + 1 } });
    res.status(201).json({ banco });
  })
);

configRouter.put(
  "/bancos/:id",
  wrap(async (req, res) => {
    const data = bancoSchema.parse(req.body);
    const banco = await prisma.banco.update({ where: { id: Number(req.params.id) }, data });
    res.json({ banco });
  })
);

configRouter.post(
  "/bancos/:id/mover",
  wrap(async (req, res) => {
    const { dir } = z.object({ dir: z.enum(["up", "down"]) }).parse(req.body);
    const id = Number(req.params.id);
    const bancos = await prisma.banco.findMany({ orderBy: { orden: "asc" } });
    const i = bancos.findIndex((b) => b.id === id);
    const j = dir === "up" ? i - 1 : i + 1;
    if (i >= 0 && j >= 0 && j < bancos.length) {
      [bancos[i], bancos[j]] = [bancos[j], bancos[i]];
      await prisma.$transaction(
        bancos.map((b, idx) => prisma.banco.update({ where: { id: b.id }, data: { orden: idx + 1 } }))
      );
    }
    res.json({ ok: true });
  })
);

configRouter.delete(
  "/bancos/:id",
  wrap(async (req, res) => {
    await prisma.banco.delete({ where: { id: Number(req.params.id) } });
    res.json({ ok: true });
  })
);

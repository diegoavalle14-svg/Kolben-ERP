import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import multer from "multer";
import sharp from "sharp";
import path from "node:path";
import fs from "node:fs/promises";
import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import {
  ajustarStockFifo,
  editarLoteInicialFifo,
  mesActualHonduras,
} from "../../services/fifo.service.js";

export const productosRouter = Router();
export const categoriasRouter = Router();
export const marcasRouter = Router();

const UPLOADS = path.resolve(process.cwd(), "uploads");
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });

const wrap =
  (fn: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) =>
    fn(req, res).catch(next);

const num = (d: Prisma.Decimal | number | null | undefined) => (d == null ? 0 : Number(d));
const idOf = (req: Request) => Number(req.params.id);

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** Guarda imagen redimensionada con sharp y devuelve la ruta relativa. */
async function guardarImagen(buf: Buffer, carpeta: "productos" | "logos", nombre: string, lado: number) {
  const dir = path.join(UPLOADS, carpeta);
  await fs.mkdir(dir, { recursive: true });
  const archivo = `${nombre}-${Date.now()}.webp`;
  await sharp(buf)
    .rotate()
    .resize(lado, lado, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 82 })
    .toFile(path.join(dir, archivo));
  return `${carpeta}/${archivo}`;
}

async function borrarImagen(rel: string | null | undefined) {
  if (!rel) return;
  await fs.rm(path.join(UPLOADS, rel), { force: true }).catch(() => undefined);
}

async function historial(
  tx: Prisma.TransactionClient,
  entidad: string,
  entidadId: number,
  cambios: Record<string, [unknown, unknown]>
) {
  const filas = Object.entries(cambios)
    .filter(([, [a, b]]) => String(a ?? "") !== String(b ?? ""))
    .map(([campo, [a, b]]) => ({
      entidad,
      entidadId: String(entidadId),
      campo,
      antes: a == null ? null : String(a),
      despues: b == null ? null : String(b),
    }));
  if (filas.length) await tx.historial.createMany({ data: filas });
}

/* ───────────── Categorías ───────────── */

const categoriaSchema = z.object({
  nombre: z.string().trim().min(1),
  empaque: z.coerce
    .number()
    .int()
    .refine((v) => [10, 20, 50].includes(v), "El empaque debe ser 10, 20 o 50")
    .optional(),
  multiplicador: z.coerce.number().min(0.001).max(999).optional(),
});

categoriasRouter.get(
  "/",
  wrap(async (_req, res) => {
    const categorias = await prisma.categoria.findMany({ orderBy: { orden: "asc" } });
    res.json({ categorias: categorias.map((c) => ({ ...c, multiplicador: num(c.multiplicador) })) });
  })
);

categoriasRouter.post(
  "/",
  wrap(async (req, res) => {
    const data = categoriaSchema.parse(req.body);
    const max = await prisma.categoria.aggregate({ _max: { orden: true } });
    const categoria = await prisma.categoria.create({ data: { ...data, orden: (max._max.orden ?? 0) + 1 } });
    res.status(201).json({ categoria });
  })
);

categoriasRouter.put(
  "/:id",
  wrap(async (req, res) => {
    const data = categoriaSchema.parse(req.body);
    const categoria = await prisma.categoria.update({ where: { id: idOf(req) }, data });
    res.json({ categoria });
  })
);

async function mover(model: "categoria" | "marca", id: number, dir: "up" | "down") {
  const delegate = (prisma as any)[model];
  const todos: { id: number; orden: number }[] = await delegate.findMany({ orderBy: { orden: "asc" } });
  const i = todos.findIndex((x) => x.id === id);
  const j = dir === "up" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= todos.length) return;
  [todos[i], todos[j]] = [todos[j], todos[i]];
  await prisma.$transaction(
    todos.map((x, idx) => delegate.update({ where: { id: x.id }, data: { orden: idx + 1 } }))
  );
}

const moverSchema = z.object({ dir: z.enum(["up", "down"]) });

categoriasRouter.post(
  "/:id/mover",
  wrap(async (req, res) => {
    await mover("categoria", idOf(req), moverSchema.parse(req.body).dir);
    res.json({ ok: true });
  })
);

categoriasRouter.delete(
  "/:id",
  wrap(async (req, res) => {
    const usos = await prisma.producto.count({ where: { categoriaId: idOf(req) } });
    if (usos) throw new HttpError(409, "La categoría tiene códigos; no se puede eliminar");
    await prisma.categoria.delete({ where: { id: idOf(req) } });
    res.json({ ok: true });
  })
);

/* ───────────── Marcas ───────────── */

const marcaSchema = z.object({ nombre: z.string().trim().min(1) });

marcasRouter.get(
  "/",
  wrap(async (_req, res) => {
    res.json({ marcas: await prisma.marca.findMany({ orderBy: { orden: "asc" } }) });
  })
);

marcasRouter.post(
  "/",
  wrap(async (req, res) => {
    const data = marcaSchema.parse(req.body);
    const max = await prisma.marca.aggregate({ _max: { orden: true } });
    const marca = await prisma.marca.create({ data: { ...data, orden: (max._max.orden ?? 0) + 1 } });
    res.status(201).json({ marca });
  })
);

marcasRouter.put(
  "/:id",
  wrap(async (req, res) => {
    const marca = await prisma.marca.update({ where: { id: idOf(req) }, data: marcaSchema.parse(req.body) });
    res.json({ marca });
  })
);

marcasRouter.post(
  "/:id/mover",
  wrap(async (req, res) => {
    await mover("marca", idOf(req), moverSchema.parse(req.body).dir);
    res.json({ ok: true });
  })
);

marcasRouter.post(
  "/:id/logo",
  upload.single("logo"),
  wrap(async (req, res) => {
    if (!req.file) throw new HttpError(400, "Falta el archivo del logo");
    const actual = await prisma.marca.findUnique({ where: { id: idOf(req) } });
    if (!actual) throw new HttpError(404, "Marca no encontrada");
    const logoPath = await guardarImagen(req.file.buffer, "logos", `marca-${actual.id}`, 160);
    const marca = await prisma.marca.update({ where: { id: actual.id }, data: { logoPath } });
    await borrarImagen(actual.logoPath);
    res.json({ marca });
  })
);

marcasRouter.delete(
  "/:id",
  wrap(async (req, res) => {
    const usos = await prisma.producto.count({ where: { marcaId: idOf(req) } });
    if (usos) throw new HttpError(409, "La marca tiene códigos; no se puede eliminar");
    const m = await prisma.marca.delete({ where: { id: idOf(req) } });
    await borrarImagen(m.logoPath);
    res.json({ ok: true });
  })
);

/* ───────────── Productos ───────────── */

const productoSchema = z.object({
  codigo: z.string().trim().min(1),
  categoriaId: z.coerce.number().int(),
  marcaId: z.coerce.number().int(),
  descripcion: z.string().trim().min(1),
  cbmUnidad: z.coerce.number().min(0).default(0),
  activo: z.boolean().default(true),
  posicion: z.coerce.number().int().min(1).optional(),
});

const arranqueSchema = z.object({
  stockInicial: z.coerce.number().int().min(0).default(0),
  fobUnidad: z.coerce.number().min(0).default(0),
  costoUnidad: z.coerce.number().min(0).default(0),
});

type ProdConLotes = Prisma.ProductoGetPayload<{
  include: {
    lotes: true;
    categoria: true;
    marca: true;
    lineasProforma: { select: { cantidad: true } };
  };
}>;

function resumen(p: ProdConLotes) {
  const lotes = p.lotes.filter((l) => l.quedan > 0);
  const stock = lotes.reduce((s, l) => s + l.quedan, 0);
  const apartado = p.lineasProforma.reduce((s, lp) => s + lp.cantidad, 0);
  const valorCosto = lotes.reduce((s, l) => s + l.quedan * num(l.costoUnidad), 0);
  const mult = num(p.categoria.multiplicador);
  const valorVenta = lotes.reduce((s, l) => s + l.quedan * num(l.fobUnidad) * mult, 0);
  const disponible = stock - apartado;
  return {
    id: p.id,
    codigo: p.codigo,
    descripcion: p.descripcion,
    categoriaId: p.categoriaId,
    marcaId: p.marcaId,
    marca: p.marca.nombre,
    marcaLogo: p.marca.logoPath,
    cbmUnidad: num(p.cbmUnidad),
    fotoPath: p.fotoPath,
    activo: p.activo,
    posicion: p.posicion,
    stock,
    apartado,
    disponible,
    valorCosto,
    valorVenta,
    enCatalogo: p.activo && disponible > 0,
  };
}

const includeProd = {
  lotes: true,
  categoria: true,
  marca: true,
  lineasProforma: {
    where: { proforma: { estado: "PENDIENTE" as const } },
    select: { cantidad: true },
  },
};

productosRouter.get(
  "/",
  wrap(async (req, res) => {
    const q = String(req.query.q ?? "").trim();
    const categoriaId = req.query.categoriaId ? Number(req.query.categoriaId) : undefined;
    const marcaId = req.query.marcaId ? Number(req.query.marcaId) : undefined;
    const estado = String(req.query.estado ?? "");

    const where: Prisma.ProductoWhereInput = {
      ...(categoriaId ? { categoriaId } : {}),
      ...(marcaId ? { marcaId } : {}),
      ...(estado === "activo" ? { activo: true } : estado === "inactivo" ? { activo: false } : {}),
      ...(q
        ? {
            OR: [
              { codigo: { contains: q, mode: "insensitive" } },
              { descripcion: { contains: q, mode: "insensitive" } },
              { marca: { nombre: { contains: q, mode: "insensitive" } } },
            ],
          }
        : {}),
    };

    const [categorias, productos, facturasReales] = await Promise.all([
      prisma.categoria.findMany({ orderBy: { orden: "asc" } }),
      prisma.producto.findMany({
        where,
        include: includeProd,
      }),
      prisma.factura.count({ where: { cargaInicial: false } }),
    ]);

    const filas = productos
      .map(resumen)
      .filter((p) => (estado === "sin-stock" ? p.disponible <= 0 : true));
    const marcasOrden = new Map(
      (await prisma.marca.findMany()).map((m) => [m.id, m.orden] as const)
    );
    filas.sort(
      (a, b) =>
        (marcasOrden.get(a.marcaId) ?? 0) - (marcasOrden.get(b.marcaId) ?? 0) ||
        a.posicion - b.posicion ||
        a.codigo.localeCompare(b.codigo)
    );

    const suma = (arr: typeof filas) => ({
      codigos: arr.length,
      valorCosto: arr.reduce((s, p) => s + p.valorCosto, 0),
      valorVenta: arr.reduce((s, p) => s + p.valorVenta, 0),
    });

    const grupos = categorias
      .map((c) => {
        const items = filas.filter((p) => p.categoriaId === c.id);
        return { categoria: { id: c.id, nombre: c.nombre, orden: c.orden }, productos: items, totales: suma(items) };
      })
      .filter((g) => g.productos.length > 0);

    res.json({ grupos, total: suma(filas), enArranque: facturasReales === 0 });
  })
);

productosRouter.get(
  "/:id",
  wrap(async (req, res) => {
    const id = idOf(req);
    const p = await prisma.producto.findUnique({
      where: { id },
      include: {
        ...includeProd,
        lotes: {
          include: { pedido: { select: { numero: true } } },
          orderBy: [{ fechaRecibido: "asc" }, { id: "asc" }],
        },
        ajustes: {
          orderBy: [{ fecha: "desc" }, { id: "desc" }],
        },
      },
    });
    if (!p) throw new HttpError(404, "Código no encontrado");

    const inicial = p.lotes.find((l) => l.esInicial);
    // El lote que sale ahora es el más viejo con quedan > 0 (fechaRecibido ASC, id ASC)
    const loteViejoActivo = p.lotes.find((l) => l.quedan > 0) ?? null;

    const lotesDetalle = [...p.lotes]
      .sort((a, b) => b.fechaRecibido.getTime() - a.fechaRecibido.getTime() || b.id - a.id)
      .map((l) => ({
        id: l.id,
        esInicial: l.esInicial,
        pedidoId: l.pedidoId,
        pedidoNumero: l.pedido?.numero ?? null,
        fechaRecibido: l.fechaRecibido,
        cantidad: l.cantidad,
        quedan: l.quedan,
        vendidas: Math.max(0, l.cantidad - l.quedan),
        fobUnidad: num(l.fobUnidad),
        aduanaUnidad: num(l.aduanaUnidad),
        costoUnidad: num(l.costoUnidad),
      }));

    const historialProducto = await prisma.historial.findMany({
      where: { entidad: "Producto", entidadId: String(id) },
      orderBy: [{ fecha: "desc" }, { id: "desc" }],
      take: 30,
    });

    res.json({
      producto: {
        ...resumen(p),
        categoria: p.categoria.nombre,
        costoSaleAhora: loteViejoActivo ? num(loteViejoActivo.costoUnidad) : null,
        loteSaleAhora: loteViejoActivo
          ? loteViejoActivo.esInicial
            ? "lote Inicial"
            : `lote pedido ${loteViejoActivo.pedido?.numero ?? loteViejoActivo.pedidoId ?? ""}`.trim()
          : null,
        lotesInicial: inicial
          ? {
              id: inicial.id,
              stock: inicial.cantidad,
              quedan: inicial.quedan,
              vendidas: Math.max(0, inicial.cantidad - inicial.quedan),
              fob: num(inicial.fobUnidad),
              costo: num(inicial.costoUnidad),
            }
          : null,
      },
      lotes: lotesDetalle,
      ajustes: p.ajustes,
      historial: historialProducto,
    });
  })
);

const ajusteSchema = z.object({
  tipo: z.enum(["SALE", "ENTRA"]).optional(),
  unidades: z.coerce.number().int(),
  motivo: z.string().trim().min(1, "El motivo es obligatorio"),
});

productosRouter.post(
  "/:id/ajustes",
  wrap(async (req, res) => {
    const productoId = idOf(req);
    const body = ajusteSchema.parse(req.body);
    const prod = await prisma.producto.findUnique({ where: { id: productoId } });
    if (!prod) throw new HttpError(404, "Código no encontrado");

    const abs = Math.abs(body.unidades);
    if (abs === 0) throw new HttpError(400, "Las unidades deben ser mayores que 0");
    const signedUnidades = body.tipo
      ? body.tipo === "SALE"
        ? -abs
        : abs
      : body.unidades;

    const ajuste = await prisma.$transaction((tx) =>
      ajustarStockFifo(tx, {
        productoId,
        unidades: signedUnidades,
        motivo: body.motivo,
      })
    );

    res.status(201).json({ ajuste });
  })
);

const loteInicialSchema = z.object({
  fobUnidad: z.coerce.number().min(0),
  costoUnidad: z.coerce.number().min(0),
  motivo: z.string().trim().min(1, "El motivo es obligatorio"),
});

productosRouter.put(
  "/:id/lote-inicial",
  wrap(async (req, res) => {
    const productoId = idOf(req);
    const body = loteInicialSchema.parse(req.body);
    const prod = await prisma.producto.findUnique({ where: { id: productoId } });
    if (!prod) throw new HttpError(404, "Código no encontrado");

    const resultado = await prisma.$transaction((tx) =>
      editarLoteInicialFifo(tx, {
        productoId,
        fobUnidad: body.fobUnidad,
        costoUnidad: body.costoUnidad,
        motivo: body.motivo,
      })
    );

    res.json(resultado);
  })
);

productosRouter.post(
  "/",
  wrap(async (req, res) => {
    const data = productoSchema.parse(req.body);
    const arr = arranqueSchema.parse(req.body);
    if (arr.costoUnidad < arr.fobUnidad) throw new HttpError(400, "El costo por unidad no puede ser menor que el FOB");

    const producto = await prisma.$transaction(async (tx) => {
      const existe = await tx.producto.findUnique({ where: { codigo: data.codigo } });
      if (existe) throw new HttpError(409, "Ya existe un código con ese nombre");
      const facturasReales = await tx.factura.count({ where: { cargaInicial: false } });
      const enArranque = facturasReales === 0;
      if (!enArranque && arr.stockInicial > 0) {
        throw new HttpError(409, "El stock inicial solo se puede cargar durante el arranque");
      }

      const total = await tx.producto.count({
        where: { categoriaId: data.categoriaId, marcaId: data.marcaId },
      });
      const pos = Math.min(data.posicion ?? total + 1, total + 1);
      // Hace espacio en la posición pedida
      await tx.producto.updateMany({
        where: { categoriaId: data.categoriaId, marcaId: data.marcaId, posicion: { gte: pos } },
        data: { posicion: { increment: 1 } },
      });
      const p = await tx.producto.create({ data: { ...data, posicion: pos } });
      if (enArranque && arr.stockInicial > 0) {
        await tx.lote.create({
          data: {
            productoId: p.id,
            esInicial: true,
            fechaRecibido: new Date(),
            cantidad: arr.stockInicial,
            quedan: arr.stockInicial,
            fobUnidad: arr.fobUnidad,
            aduanaUnidad: arr.costoUnidad - arr.fobUnidad,
            costoUnidad: arr.costoUnidad,
          },
        });
      } else {
        const ahora = new Date();
        const { anio, mes } = mesActualHonduras(ahora);
        await tx.periodoSinStock.create({ data: { productoId: p.id, desde: ahora } });
        await tx.mesSinStock.upsert({
          where: { productoId_anio_mes: { productoId: p.id, anio, mes } },
          update: {},
          create: { productoId: p.id, anio, mes },
        });
      }
      await historial(tx, "Producto", p.id, { creado: [null, p.codigo] });
      return p;
    });
    res.status(201).json({ producto });
  })
);

productosRouter.put(
  "/:id",
  wrap(async (req, res) => {
    const id = idOf(req);
    const data = productoSchema.parse(req.body);
    await prisma.$transaction(async (tx) => {
      const antes = await tx.producto.findUnique({ where: { id } });
      if (!antes) throw new HttpError(404, "Código no encontrado");
      if ( data.codigo !== antes.codigo) {
        const dup = await tx.producto.findUnique({ where: { codigo: data.codigo } });
        if (dup) throw new HttpError(409, "Ya existe un código con ese nombre");
      }
      if (antes.activo && !data.activo) {
        const lotesStock = await tx.lote.aggregate({
          where: { productoId: id, quedan: { gt: 0 } },
          _sum: { quedan: true },
        });
        const stockActual = lotesStock._sum.quedan ?? 0;
        const apartadoAgg = await tx.lineaProforma.aggregate({
          where: { productoId: id, proforma: { estado: "PENDIENTE" } },
          _sum: { cantidad: true },
        });
        const apartadoActual = apartadoAgg._sum.cantidad ?? 0;
        const enPedidoActivo = await tx.lineaPedido.count({
          where: {
            productoId: id,
            pedido: { estado: { in: ["EN_PRODUCCION", "EN_CAMINO"] } },
          },
        });
        if (stockActual > 0 || apartadoActual > 0 || enPedidoActivo > 0) {
          throw new HttpError(
            409,
            "Solo se puede inactivar un código con stock 0, sin unidades apartadas y sin pedido activo"
          );
        }
      }
      const grupoCambia = data.categoriaId !== antes.categoriaId || data.marcaId !== antes.marcaId;
      let posicion = antes.posicion;
      if (grupoCambia) {
        const total = await tx.producto.count({
          where: { categoriaId: data.categoriaId, marcaId: data.marcaId },
        });
        posicion = Math.min(data.posicion ?? total + 1, total + 1);
        await tx.producto.updateMany({
          where: { categoriaId: antes.categoriaId, marcaId: antes.marcaId, posicion: { gt: antes.posicion } },
          data: { posicion: { decrement: 1 } },
        });
        await tx.producto.updateMany({
          where: { categoriaId: data.categoriaId, marcaId: data.marcaId, posicion: { gte: posicion } },
          data: { posicion: { increment: 1 } },
        });
      } else if (data.posicion && data.posicion !== antes.posicion) {
        const total = await tx.producto.count({
          where: { categoriaId: antes.categoriaId, marcaId: antes.marcaId },
        });
        posicion = Math.min(data.posicion, total);
        const hermanos = await tx.producto.findMany({
          where: { categoriaId: antes.categoriaId, marcaId: antes.marcaId, id: { not: id } },
          orderBy: { posicion: "asc" },
        });
        hermanos.splice(posicion - 1, 0, antes);
        for (let i = 0; i < hermanos.length; i++) {
          if (hermanos[i].id !== id)
            await tx.producto.update({ where: { id: hermanos[i].id }, data: { posicion: i + 1 } });
        }
      }
      await tx.producto.update({
        where: { id },
        data: {
          codigo: data.codigo,
          categoriaId: data.categoriaId,
          marcaId: data.marcaId,
          descripcion: data.descripcion,
          cbmUnidad: data.cbmUnidad,
          activo: data.activo,
          posicion,
        },
      });
      await historial(tx, "Producto", id, {
        codigo: [antes.codigo, data.codigo],
        categoriaId: [antes.categoriaId, data.categoriaId],
        marcaId: [antes.marcaId, data.marcaId],
        descripcion: [antes.descripcion, data.descripcion],
        cbmUnidad: [num(antes.cbmUnidad), data.cbmUnidad],
        activo: [antes.activo, data.activo],
      });
    });
    res.json({ ok: true });
  })
);

productosRouter.post(
  "/:id/foto",
  upload.single("foto"),
  wrap(async (req, res) => {
    if (!req.file) throw new HttpError(400, "Falta la foto");
    const p = await prisma.producto.findUnique({ where: { id: idOf(req) } });
    if (!p) throw new HttpError(404, "Código no encontrado");
    const fotoPath = await guardarImagen(req.file.buffer, "productos", `prod-${p.id}`, 800);
    await prisma.producto.update({ where: { id: p.id }, data: { fotoPath } });
    await borrarImagen(p.fotoPath);
    res.json({ fotoPath });
  })
);

/** Guarda un orden completo para un grupo: [{id, posicion}] (numeración 1..n por categoría+marca). */
const ordenSchema = z.object({
  items: z.array(z.object({ id: z.number().int(), posicion: z.number().int().min(1) })).min(1),
});

productosRouter.post(
  "/orden",
  wrap(async (req, res) => {
    const { items } = ordenSchema.parse(req.body);
    await prisma.$transaction(async (tx) => {
      const prods = await tx.producto.findMany({ where: { id: { in: items.map((i) => i.id) } } });
      const grupos = new Map<string, typeof items>();
      for (const it of items) {
        const p = prods.find((x) => x.id === it.id);
        if (!p) continue;
        const k = `${p.categoriaId}:${p.marcaId}`;
        grupos.set(k, [...(grupos.get(k) ?? []), it]);
      }
      for (const lista of grupos.values()) {
        // Desempate estable: por posición pedida y luego por orden recibido
        const ordenados = lista
          .map((it, idx) => ({ ...it, idx }))
          .sort((a, b) => a.posicion - b.posicion || a.idx - b.idx);
        for (let i = 0; i < ordenados.length; i++) {
          await tx.producto.update({ where: { id: ordenados[i].id }, data: { posicion: i + 1 } });
        }
      }
    });
    res.json({ ok: true });
  })
);

productosRouter.post(
  "/:id/mover",
  wrap(async (req, res) => {
    const id = idOf(req);
    const { dir } = moverSchema.parse(req.body);
    await prisma.$transaction(async (tx) => {
      const p = await tx.producto.findUnique({ where: { id } });
      if (!p) throw new HttpError(404, "Código no encontrado");
      const grupo = await tx.producto.findMany({
        where: { categoriaId: p.categoriaId, marcaId: p.marcaId },
        orderBy: [{ posicion: "asc" }, { id: "asc" }],
      });
      const i = grupo.findIndex((x) => x.id === id);
      const j = dir === "up" ? i - 1 : i + 1;
      if (i < 0 || j < 0 || j >= grupo.length) return;
      [grupo[i], grupo[j]] = [grupo[j], grupo[i]];
      for (let idx = 0; idx < grupo.length; idx++) {
        await tx.producto.update({ where: { id: grupo[idx].id }, data: { posicion: idx + 1 } });
      }
    });
    res.json({ ok: true });
  })
);

productosRouter.delete(
  "/:id",
  wrap(async (req, res) => {
    const id = idOf(req);
    const p = await prisma.producto.findUnique({ where: { id }, include: { lotes: true } });
    if (!p) throw new HttpError(404, "Código no encontrado");
    const otrosLotes = p.lotes.filter((l) => !l.esInicial || l.quedan !== l.cantidad);
    const ventas =
      (await prisma.lineaFactura.count({ where: { productoId: id } })) +
      (await prisma.lineaProforma.count({ where: { productoId: id } })) +
      (await prisma.lineaPedido.count({ where: { productoId: id } })) +
      (await prisma.ajusteStock.count({ where: { productoId: id } }));
    if (otrosLotes.length || ventas)
      throw new HttpError(409, "Tiene movimientos (lotes, ventas o pedidos); mejor inactívelo");
    await prisma.$transaction(async (tx) => {
      await tx.mesSinStock.deleteMany({ where: { productoId: id } });
      await tx.periodoSinStock.deleteMany({ where: { productoId: id } });
      await tx.precioCliente.deleteMany({ where: { productoId: id } });
      await tx.ventaBase.deleteMany({ where: { productoId: id } });
      await tx.lote.deleteMany({ where: { productoId: id } });
      await tx.producto.delete({ where: { id } });
      await tx.producto.updateMany({
        where: { categoriaId: p.categoriaId, marcaId: p.marcaId, posicion: { gt: p.posicion } },
        data: { posicion: { decrement: 1 } },
      });
      await historial(tx, "Producto", id, { eliminado: [p.codigo, null] });
    });
    await borrarImagen(p.fotoPath);
    res.json({ ok: true });
  })
);

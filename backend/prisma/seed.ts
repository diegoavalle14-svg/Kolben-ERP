import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const CATEGORIAS = [
  { nombre: "M. Freno", multiplicador: 2.35 },
  { nombre: "M. Clutch", multiplicador: 2.4 },
  { nombre: "Aux de Rueda", multiplicador: 2.2 },
  { nombre: "Aux de Clutch", multiplicador: 2.3 },
];
const MARCAS = ["Toyota", "Nissan", "Isuzu", "Mazda", "Honda", "Kia"];

// [código, categoría, marca, descripción, stock, fob, costo]
const PRODUCTOS: [string, string, string, string, number, number, number][] = [
  ["FT-2150", "M. Freno", "Toyota", "Cilindro maestro de freno\nHilux 2.4 / 2.8\n15/16\"", 24, 310, 372],
  ["FT-2151", "M. Freno", "Toyota", "Cilindro maestro de freno\nCorolla 1.6\n7/8\"", 12, 280, 336],
  ["FT-2160", "M. Freno", "Toyota", "Cilindro maestro de freno\nLand Cruiser 80\n1\"", 0, 0, 0],
  ["FN-3010", "M. Freno", "Nissan", "Cilindro maestro de freno\nFrontier 2.5\n15/16\"", 18, 295, 354],
  ["FI-4020", "M. Freno", "Isuzu", "Cilindro maestro de freno\nD-Max 3.0\n1\"", 9, 330, 396],
  ["CT-5100", "M. Clutch", "Toyota", "Cilindro maestro de clutch\nHilux 2.4\n5/8\"", 15, 260, 312],
  ["CN-5200", "M. Clutch", "Nissan", "Cilindro maestro de clutch\nFrontier 2.5\n3/4\"", 7, 255, 306],
  ["RT-6100", "Aux de Rueda", "Toyota", "Cilindro de rueda\nHilux trasero\n13/16\"", 40, 90, 108],
  ["RM-6200", "Aux de Rueda", "Mazda", "Cilindro de rueda\nB2200 trasero\n3/4\"", 22, 85, 102],
  ["AT-7100", "Aux de Clutch", "Toyota", "Cilindro auxiliar de clutch\nHilux 2.8\n3/4\"", 11, 140, 168],
];

async function main() {
  for (const [i, c] of CATEGORIAS.entries()) {
    await prisma.categoria.upsert({
      where: { nombre: c.nombre },
      update: {},
      create: { nombre: c.nombre, multiplicador: c.multiplicador, orden: i + 1 },
    });
  }
  for (const [i, nombre] of MARCAS.entries()) {
    await prisma.marca.upsert({ where: { nombre }, update: {}, create: { nombre, orden: i + 1 } });
  }
  for (const [codigo, cat, marca, descripcion, stock, fob, costo] of PRODUCTOS) {
    if (await prisma.producto.findUnique({ where: { codigo } })) continue;
    const categoria = await prisma.categoria.findUniqueOrThrow({ where: { nombre: cat } });
    const m = await prisma.marca.findUniqueOrThrow({ where: { nombre: marca } });
    const posicion = (await prisma.producto.count({ where: { categoriaId: categoria.id, marcaId: m.id } })) + 1;
    const p = await prisma.producto.create({
      data: { codigo, categoriaId: categoria.id, marcaId: m.id, descripcion, cbmUnidad: 0.03, posicion },
    });
    if (stock > 0) {
      await prisma.lote.create({
        data: {
          productoId: p.id,
          esInicial: true,
          fechaRecibido: new Date(),
          cantidad: stock,
          quedan: stock,
          fobUnidad: fob,
          aduanaUnidad: costo - fob,
          costoUnidad: costo,
        },
      });
    } else {
      await prisma.periodoSinStock.create({ data: { productoId: p.id, desde: new Date() } });
    }
  }
  console.log("Seed de productos listo (datos de ejemplo, no reales).");
}

main().finally(() => prisma.$disconnect());

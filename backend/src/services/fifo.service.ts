import { Prisma } from "@prisma/client";

export class FifoError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** Obtiene el año y mes actual en zona horaria de Honduras (UTC-6, America/Tegucigalpa). */
export function mesActualHonduras(d = new Date()): { anio: number; mes: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Tegucigalpa",
    year: "numeric",
    month: "numeric",
  }).formatToParts(d);
  const anio = Number(parts.find((p) => p.type === "year")?.value ?? d.getUTCFullYear());
  const mes = Number(parts.find((p) => p.type === "month")?.value ?? d.getUTCMonth() + 1);
  return { anio, mes };
}

/**
 * Registra el mes en MesSinStock y abre PeriodoSinStock cuando el stock de un código queda en 0.
 * Si el stock pasa de 0 a > 0, cierra el PeriodoSinStock abierto.
 */
export async function sincronizarEstadoStockCero(
  tx: Prisma.TransactionClient,
  productoId: number,
  stockAntes: number,
  stockDespues: number,
  fecha = new Date()
) {
  if (stockDespues === 0) {
    const { anio, mes } = mesActualHonduras(fecha);
    await tx.mesSinStock.upsert({
      where: { productoId_anio_mes: { productoId, anio, mes } },
      update: {},
      create: { productoId, anio, mes },
    });
    const abierto = await tx.periodoSinStock.findFirst({
      where: { productoId, hasta: null },
    });
    if (!abierto) {
      await tx.periodoSinStock.create({
        data: { productoId, desde: fecha },
      });
    }
  } else if (stockAntes === 0 && stockDespues > 0) {
    await tx.periodoSinStock.updateMany({
      where: { productoId, hasta: null },
      data: { hasta: fecha },
    });
  }
}

/**
 * Ajusta el stock de un producto siguiendo las reglas FIFO de la especificación v1.1:
 * - Si unidades < 0 (sale): descuenta primero del lote más viejo (fechaRecibido ASC, id ASC) con quedan > 0.
 * - Si unidades > 0 (entra): suma al lote más nuevo (fechaRecibido DESC, id DESC).
 * - Registra AjusteStock, Historial y MesSinStock si el stock queda en 0.
 */
export async function ajustarStockFifo(
  tx: Prisma.TransactionClient,
  params: {
    productoId: number;
    unidades: number;
    motivo: string;
    fecha?: Date;
  }
) {
  const { productoId, unidades, motivo } = params;
  const fecha = params.fecha ?? new Date();
  const motivoLimpio = motivo.trim();

  if (!Number.isInteger(unidades) || unidades === 0) {
    throw new FifoError(400, "La cantidad de unidades debe ser un entero distinto de 0");
  }
  if (!motivoLimpio) {
    throw new FifoError(400, "El motivo del ajuste es obligatorio");
  }

  const lotes = await tx.lote.findMany({
    where: { productoId },
    orderBy: [{ fechaRecibido: "asc" }, { id: "asc" }],
  });

  const stockAntes = lotes.reduce((acc, l) => acc + l.quedan, 0);
  const stockDespues = stockAntes + unidades;

  if (stockDespues < 0) {
    throw new FifoError(
      409,
      `No se pueden sacar ${Math.abs(unidades)} unidades: el stock actual es ${stockAntes}`
    );
  }

  if (unidades < 0) {
    let porSacar = Math.abs(unidades);
    for (const lote of lotes) {
      if (porSacar <= 0) break;
      if (lote.quedan <= 0) continue;
      const desc = Math.min(lote.quedan, porSacar);
      await tx.lote.update({
        where: { id: lote.id },
        data: { quedan: lote.quedan - desc },
      });
      porSacar -= desc;
    }
  } else {
    // Entra (+): suma al lote más nuevo
    const masNuevo = lotes[lotes.length - 1];
    if (masNuevo) {
      const nuevoQuedan = masNuevo.quedan + unidades;
      await tx.lote.update({
        where: { id: masNuevo.id },
        data: {
          quedan: nuevoQuedan,
          ...(nuevoQuedan > masNuevo.cantidad ? { cantidad: nuevoQuedan } : {}),
        },
      });
    } else {
      await tx.lote.create({
        data: {
          productoId,
          esInicial: true,
          fechaRecibido: fecha,
          cantidad: unidades,
          quedan: unidades,
          fobUnidad: 0,
          aduanaUnidad: 0,
          costoUnidad: 0,
        },
      });
    }
  }

  const ajuste = await tx.ajusteStock.create({
    data: {
      productoId,
      fecha,
      unidades,
      motivo: motivoLimpio,
      stockAntes,
      stockDespues,
    },
  });

  await tx.historial.create({
    data: {
      entidad: "Producto",
      entidadId: String(productoId),
      campo: "ajusteStock",
      antes: String(stockAntes),
      despues: String(stockDespues),
      motivo: `${unidades > 0 ? `+${unidades}` : unidades} u · ${motivoLimpio}`,
      fecha,
    },
  });

  await sincronizarEstadoStockCero(tx, productoId, stockAntes, stockDespues, fecha);

  return ajuste;
}

/**
 * Edita el FOB y costo por unidad del lote Inicial de un producto.
 * Actualiza LoteConsumo y LineaFactura.costoFifo de todas las piezas ya vendidas de ese lote.
 */
export async function editarLoteInicialFifo(
  tx: Prisma.TransactionClient,
  params: {
    productoId: number;
    fobUnidad: number;
    costoUnidad: number;
    motivo: string;
  }
) {
  const { productoId, fobUnidad, costoUnidad, motivo } = params;
  const motivoLimpio = motivo.trim();

  if (!motivoLimpio) {
    throw new FifoError(400, "El motivo es obligatorio para corregir el lote Inicial");
  }
  if (fobUnidad < 0 || costoUnidad < 0) {
    throw new FifoError(400, "El FOB y el costo deben ser mayores o iguales a 0");
  }
  if (costoUnidad < fobUnidad) {
    throw new FifoError(400, "El costo por unidad no puede ser menor que el FOB por unidad");
  }

  const loteInicial = await tx.lote.findFirst({
    where: { productoId, esInicial: true },
    orderBy: { id: "asc" },
  });

  if (!loteInicial) {
    throw new FifoError(404, "Este código no tiene un lote Inicial para editar");
  }

  const fobAntes = Number(loteInicial.fobUnidad);
  const costoAntes = Number(loteInicial.costoUnidad);
  const aduanaUnidad = Number((costoUnidad - fobUnidad).toFixed(4));

  const loteActualizado = await tx.lote.update({
    where: { id: loteInicial.id },
    data: {
      fobUnidad,
      aduanaUnidad,
      costoUnidad,
    },
  });

  // Buscar consumos existentes de este lote para recalcular líneas de factura ya vendidas
  const consumos = await tx.loteConsumo.findMany({
    where: { loteId: loteInicial.id },
  });

  if (consumos.length > 0) {
    await tx.loteConsumo.updateMany({
      where: { loteId: loteInicial.id },
      data: {
        costoUnidad,
        fobUnidad,
      },
    });

    const lineasIds = Array.from(new Set(consumos.map((c) => c.lineaFacturaId)));
    for (const lineaFacturaId of lineasIds) {
      const todosConsumosLinea = await tx.loteConsumo.findMany({
        where: { lineaFacturaId },
      });
      const nuevoCostoFifo = todosConsumosLinea.reduce(
        (acc, c) => acc + c.cantidad * Number(c.costoUnidad),
        0
      );
      await tx.lineaFactura.update({
        where: { id: lineaFacturaId },
        data: { costoFifo: Number(nuevoCostoFifo.toFixed(4)) },
      });
    }
  }

  const cambiosHistorial: Prisma.HistorialCreateManyInput[] = [];
  if (fobAntes !== fobUnidad) {
    cambiosHistorial.push({
      entidad: "Producto",
      entidadId: String(productoId),
      campo: "loteInicial.fobUnidad",
      antes: fobAntes.toFixed(2),
      despues: fobUnidad.toFixed(2),
      motivo: motivoLimpio,
    });
  }
  if (costoAntes !== costoUnidad) {
    cambiosHistorial.push({
      entidad: "Producto",
      entidadId: String(productoId),
      campo: "loteInicial.costoUnidad",
      antes: costoAntes.toFixed(2),
      despues: costoUnidad.toFixed(2),
      motivo: motivoLimpio,
    });
  }
  if (cambiosHistorial.length > 0) {
    await tx.historial.createMany({ data: cambiosHistorial });
  }

  const vendidas = loteInicial.cantidad - loteInicial.quedan;
  return { lote: loteActualizado, unidadesVendidasRecalculadas: vendidas };
}

/**
 * Consume stock de un código siguiendo FIFO estricto (del lote más viejo al más nuevo).
 * Crea los registros LoteConsumo para la línea de factura y devuelve el costoFifo total.
 */
export async function consumirStockFifo(
  tx: Prisma.TransactionClient,
  params: {
    productoId: number;
    lineaFacturaId: number;
    cantidad: number;
    fecha?: Date;
  }
) {
  const { productoId, lineaFacturaId, cantidad } = params;
  const fecha = params.fecha ?? new Date();

  if (cantidad <= 0) return { costoFifo: 0 };

  const lotes = await tx.lote.findMany({
    where: { productoId, quedan: { gt: 0 } },
    orderBy: [{ fechaRecibido: "asc" }, { id: "asc" }],
  });

  const stockAntes = lotes.reduce((acc, l) => acc + l.quedan, 0);
  if (stockAntes < cantidad) {
    throw new FifoError(409, `Stock insuficiente para el código (disponible en lotes: ${stockAntes}, requerido: ${cantidad})`);
  }

  let restante = cantidad;
  let costoFifo = 0;

  for (const lote of lotes) {
    if (restante <= 0) break;
    const tomar = Math.min(lote.quedan, restante);
    await tx.lote.update({
      where: { id: lote.id },
      data: { quedan: lote.quedan - tomar },
    });
    await tx.loteConsumo.create({
      data: {
        lineaFacturaId,
        loteId: lote.id,
        cantidad: tomar,
        costoUnidad: lote.costoUnidad,
        fobUnidad: lote.fobUnidad,
      },
    });
    costoFifo += tomar * Number(lote.costoUnidad);
    restante -= tomar;
  }

  const stockDespues = stockAntes - cantidad;
  await sincronizarEstadoStockCero(tx, productoId, stockAntes, stockDespues, fecha);

  return { costoFifo: Number(costoFifo.toFixed(4)) };
}

import { useCallback, useEffect, useState } from 'react';
import { Pencil } from 'lucide-react';
import { api } from '../lib/api';

interface LoteInicialInfo {
  id: number;
  stock: number;
  quedan: number;
  vendidas: number;
  fob: number;
  costo: number;
}

interface ProductoDetalle {
  id: number;
  codigo: string;
  descripcion: string;
  categoriaId: number;
  categoria: string;
  marcaId: number;
  marca: string;
  marcaLogo: string | null;
  cbmUnidad: number;
  fotoPath: string | null;
  activo: boolean;
  posicion: number;
  stock: number;
  apartado: number;
  disponible: number;
  valorCosto: number;
  valorVenta: number;
  enCatalogo: boolean;
  costoSaleAhora: number | null;
  loteSaleAhora: string | null;
  lotesInicial: LoteInicialInfo | null;
}

interface LoteFila {
  id: number;
  esInicial: boolean;
  pedidoId: number | null;
  pedidoNumero: number | null;
  fechaRecibido: string;
  cantidad: number;
  quedan: number;
  vendidas: number;
  fobUnidad: number;
  aduanaUnidad: number;
  costoUnidad: number;
}

interface AjusteFila {
  id: number;
  fecha: string;
  unidades: number;
  motivo: string;
  stockAntes: number;
  stockDespues: number;
}

interface HistorialFila {
  id: number;
  campo: string;
  antes: string | null;
  despues: string | null;
  motivo: string | null;
  fecha: string;
}

interface RespuestaFicha {
  producto: ProductoDetalle;
  lotes: LoteFila[];
  ajustes: AjusteFila[];
  historial: HistorialFila[];
}

const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function fechaCorta(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getDate()} ${MESES_CORTOS[d.getMonth()]} ${d.getFullYear()}`;
}

const money = (n: number) =>
  n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const urlImg = (p: string | null) => (p ? `/api/uploads/${p}` : null);

const label = 'block text-[10px] font-semibold uppercase tracking-[0.08em] text-kolben-muted mb-1';
const input =
  'w-full rounded-lg border border-kolben-line bg-kolben-field px-3 py-[8px] text-[13px] font-semibold text-kolben-text outline-none transition focus:border-kolben-ink focus:ring-1 focus:ring-kolben-ink tabular-nums';
const btnGhost =
  'rounded-full border border-kolben-line bg-white px-4 py-[7px] text-[10px] font-bold uppercase tracking-[0.06em] text-kolben-text transition hover:border-kolben-ink';
const btnInk =
  'rounded-full bg-kolben-ink px-4 py-[7px] text-[10px] font-bold uppercase tracking-[0.06em] text-white transition hover:bg-kolben-ink-dark disabled:opacity-50';
const btnDanger =
  'rounded-full bg-[#c84b31] px-4 py-[7px] text-[10px] font-bold uppercase tracking-[0.06em] text-white transition hover:bg-[#b03e26] disabled:opacity-50';

export default function FichaCodigo({
  id,
  onVolver,
  onEditarDatos,
  onCambioStock,
  flash,
}: {
  id: number;
  onVolver: () => void;
  onEditarDatos: (id: number) => void;
  onCambioStock: () => Promise<void>;
  flash: (tipo: 'ok' | 'error', texto: string) => void;
}) {
  const [data, setData] = useState<RespuestaFicha | null>(null);
  const [verAgotadosAntiguos, setVerAgotadosAntiguos] = useState(false);

  // Estado de Ajuste de Stock (2 pasos en línea)
  const [abiertoAjuste, setAbiertoAjuste] = useState(false);
  const [pasoAjuste, setPasoAjuste] = useState<1 | 2>(1);
  const [tipoAjuste, setTipoAjuste] = useState<'SALE' | 'ENTRA'>('SALE');
  const [unidadesAjuste, setUnidadesAjuste] = useState('1');
  const [motivoAjuste, setMotivoAjuste] = useState('');
  const [guardandoAjuste, setGuardandoAjuste] = useState(false);

  // Estado de Edición del Lote Inicial (con confirmación en línea)
  const [editandoInicial, setEditandoInicial] = useState(false);
  const [fobInicial, setFobInicial] = useState('');
  const [costoInicial, setCostoInicial] = useState('');
  const [motivoInicial, setMotivoInicial] = useState('');
  const [guardandoInicial, setGuardandoInicial] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const r = await api<RespuestaFicha>(`/productos/${id}`);
      setData(r);
    } catch (e) {
      flash('error', (e as Error).message);
    }
  }, [id, flash]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  if (!data) {
    return <div className="p-6 text-sm text-kolben-muted">Cargando ficha del código...</div>;
  }

  const { producto: p, lotes, ajustes } = data;
  const anioActual = new Date().getFullYear();
  const anioCorte = anioActual - 1;

  // Lotes agotados de años anteriores se agrupan por defecto
  const lotesPrincipales = lotes.filter(
    (l) => l.quedan > 0 || new Date(l.fechaRecibido).getFullYear() >= anioCorte
  );
  const lotesAgotadosAntiguos = lotes.filter(
    (l) => l.quedan === 0 && new Date(l.fechaRecibido).getFullYear() < anioCorte
  );
  const lotesVisibles = verAgotadosAntiguos
    ? [...lotesPrincipales, ...lotesAgotadosAntiguos]
    : lotesPrincipales;

  const uNum = Math.max(0, Math.trunc(Number(unidadesAjuste) || 0));
  const deltaAjuste = tipoAjuste === 'SALE' ? -uNum : uNum;
  const stockProyectado = p.stock + deltaAjuste;

  const abrirEditorInicial = (l: LoteFila) => {
    setFobInicial(l.fobUnidad.toFixed(2));
    setCostoInicial(l.costoUnidad.toFixed(2));
    setMotivoInicial('');
    setEditandoInicial(true);
  };

  const continuarPaso2Ajuste = () => {
    if (uNum <= 0) {
      flash('error', 'Ingresa una cantidad de unidades mayor a 0');
      return;
    }
    if (!motivoAjuste.trim()) {
      flash('error', 'El motivo del ajuste es obligatorio');
      return;
    }
    if (stockProyectado < 0) {
      flash('error', `No puedes sacar ${uNum} unidades (stock actual: ${p.stock})`);
      return;
    }
    setPasoAjuste(2);
  };

  const confirmarAjuste = async () => {
    setGuardandoAjuste(true);
    try {
      await api(`/productos/${p.id}/ajustes`, {
        method: 'POST',
        body: JSON.stringify({
          tipo: tipoAjuste,
          unidades: uNum,
          motivo: motivoAjuste.trim(),
        }),
      });
      setAbiertoAjuste(false);
      setPasoAjuste(1);
      setUnidadesAjuste('1');
      setMotivoAjuste('');
      await Promise.all([cargar(), onCambioStock()]);
      flash('ok', 'Ajuste de stock aplicado');
    } catch (e) {
      flash('error', (e as Error).message);
    } finally {
      setGuardandoAjuste(false);
    }
  };

  const confirmarCambioInicial = async () => {
    const fob = Number(fobInicial);
    const costo = Number(costoInicial);
    if (Number.isNaN(fob) || Number.isNaN(costo) || fob < 0 || costo < 0) {
      flash('error', 'Ingresa montos válidos para FOB y costo');
      return;
    }
    if (costo < fob) {
      flash('error', 'El costo por unidad no puede ser menor que el FOB');
      return;
    }
    if (!motivoInicial.trim()) {
      flash('error', 'El motivo es obligatorio para corregir el lote Inicial');
      return;
    }
    setGuardandoInicial(true);
    try {
      await api(`/productos/${p.id}/lote-inicial`, {
        method: 'PUT',
        body: JSON.stringify({
          fobUnidad: fob,
          costoUnidad: costo,
          motivo: motivoInicial.trim(),
        }),
      });
      setEditandoInicial(false);
      setMotivoInicial('');
      await Promise.all([cargar(), onCambioStock()]);
      flash('ok', 'Costo del lote Inicial actualizado');
    } catch (e) {
      flash('error', (e as Error).message);
    } finally {
      setGuardandoInicial(false);
    }
  };

  const th = 'px-4 py-2 text-left text-[9px] font-semibold uppercase tracking-[0.08em] text-kolben-muted';
  const loteInicialFila = lotes.find((l) => l.esInicial) ?? null;

  return (
    <div className="space-y-4 pb-10">
      {/* Barra superior: volver a Productos */}
      <div className="flex items-center justify-between">
        <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-kolben-muted">
          Ficha de código · Lotes FIFO y ajustes
        </div>
        <button id="btn-volver-productos" className={btnGhost} onClick={onVolver}>
          ← Volver a productos
        </button>
      </div>

      {/* CARD 1: Encabezado del código */}
      <section className="rounded-xl border border-kolben-line bg-kolben-card p-6 shadow-sm">
        <div className="grid grid-cols-[120px_1fr] gap-6">
          <div>
            <div className="flex h-[110px] w-[110px] items-center justify-center overflow-hidden rounded-xl border border-kolben-line bg-white text-[10px] text-kolben-muted">
              {p.fotoPath ? (
                <img src={urlImg(p.fotoPath)!} alt={p.codigo} className="h-full w-full object-contain" />
              ) : (
                'sin foto'
              )}
            </div>
            <div className="mt-1.5 text-center text-[9px] text-kolben-muted">
              {p.enCatalogo ? 'sale en el catálogo' : 'no sale en el catálogo'}
            </div>
          </div>

          <div className="flex flex-col justify-between">
            <div>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-[22px] font-extrabold tracking-tight text-kolben-text">{p.codigo}</h2>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded border border-kolben-line bg-white px-2 py-0.5 text-[10px] font-bold uppercase text-kolben-text">
                      {p.marcaLogo && (
                        <img src={urlImg(p.marcaLogo)!} alt={p.marca} className="h-3.5 w-3.5 object-contain" />
                      )}
                      {p.marca}
                    </span>
                    <span className="rounded bg-kolben-ink px-2 py-0.5 text-[10px] font-bold uppercase text-white">
                      {p.categoria}
                    </span>
                    <span
                      className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${
                        p.activo ? 'bg-emerald-50 text-kolben-teal' : 'bg-slate-100 text-kolben-muted'
                      }`}
                    >
                      {p.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </div>
                </div>

                <button
                  id="btn-editar-codigo"
                  className={btnGhost}
                  onClick={() => onEditarDatos(p.id)}
                >
                  <Pencil size={11} className="mr-1 inline" /> Editar
                </button>
              </div>

              <div className="mt-2.5 text-[13px] font-semibold text-kolben-text">
                {p.descripcion.split('\n').map((s) => s.trim()).filter(Boolean).join(' · ')}
              </div>
              <div className="mt-0.5 text-[11px] text-kolben-muted">
                CBM por unidad {p.cbmUnidad.toFixed(3)} ·{' '}
                {p.enCatalogo
                  ? 'sale en el catálogo'
                  : `no sale en el catálogo (${!p.activo ? 'inactivo' : 'sin disponible'})`}
              </div>
            </div>

            {/* Métricas del código */}
            <div className="mt-4 grid grid-cols-[70px_70px_80px_150px_160px_1fr] gap-4 border-t border-kolben-line pt-3">
              <div>
                <div className="text-[9px] font-semibold uppercase tracking-[0.08em] text-kolben-muted">Stock</div>
                <div className={`text-[18px] font-extrabold tabular-nums ${p.stock === 0 ? 'text-kolben-red' : 'text-kolben-text'}`}>
                  {p.stock}
                </div>
              </div>
              <div>
                <div className="text-[9px] font-semibold uppercase tracking-[0.08em] text-kolben-muted">Apartado</div>
                <div className="text-[18px] font-extrabold tabular-nums text-kolben-text">{p.apartado}</div>
              </div>
              <div>
                <div className="text-[9px] font-semibold uppercase tracking-[0.08em] text-kolben-muted">Disponible</div>
                <div className={`text-[18px] font-extrabold tabular-nums ${p.disponible <= 0 ? 'text-kolben-red' : 'text-kolben-text'}`}>
                  {p.disponible}
                </div>
              </div>
              <div>
                <div className="text-[9px] font-semibold uppercase tracking-[0.08em] text-kolben-muted">
                  Valor del stock · a costo
                </div>
                <div className="text-[17px] font-extrabold tabular-nums text-kolben-text">
                  L {money(p.valorCosto)}
                </div>
              </div>
              <div>
                <div className="text-[9px] font-semibold uppercase tracking-[0.08em] text-kolben-muted">
                  Valor a precio de venta
                </div>
                <div className="text-[17px] font-extrabold tabular-nums text-kolben-teal">
                  L {money(p.valorVenta)}
                </div>
              </div>
              <div>
                <div className="text-[9px] font-semibold uppercase tracking-[0.08em] text-kolben-muted">
                  Costo de lo que sale ahora
                </div>
                <div className="mt-1 text-[12px] font-bold tabular-nums text-kolben-text">
                  {p.costoSaleAhora != null
                    ? `L ${money(p.costoSaleAhora)} por unidad · ${p.loteSaleAhora}`
                    : '— sin stock disponible'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CARD 2: LOTES · FIFO */}
      <section className="overflow-hidden rounded-xl border border-kolben-line bg-kolben-card shadow-sm">
        <div className="flex items-center justify-between border-b border-kolben-line px-4 py-3">
          <h3 className="text-[11px] font-bold uppercase tracking-[0.08em] text-kolben-text">
            Lotes · FIFO · Sale primero el más viejo
          </h3>
          <span className="text-[11px] text-kolben-muted">
            solo lectura · se crean al recibir un pedido
          </span>
        </div>

        <table className="w-full border-collapse text-[12px]">
          <thead>
            <tr className="border-b border-kolben-line bg-kolben-bg/40">
              <th className={th}>Pedido</th>
              <th className={th}>Recibido</th>
              <th className={`${th} text-right`}>Cantidad</th>
              <th className={`${th} text-right`}>Quedan</th>
              <th className={`${th} text-right`}>FOB/u (L)</th>
              <th className={`${th} text-right`}>Aduana/u (L)</th>
              <th className={`${th} text-right`}>Costo/u (L)</th>
            </tr>
          </thead>
          <tbody>
            {lotes.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-kolben-muted">
                  Este código aún no tiene lotes registrados.
                </td>
              </tr>
            )}
            {lotesVisibles.map((l) => {
              const agotado = l.quedan === 0;
              const claseFila = agotado ? 'text-kolben-muted' : 'text-kolben-text';
              return (
                <tr key={l.id} className={`border-t border-kolben-line ${claseFila}`}>
                  <td className="px-4 py-2.5 font-bold">
                    {l.esInicial ? 'INICIAL' : l.pedidoNumero ?? l.pedidoId ?? '—'}
                  </td>
                  <td className="px-4 py-2.5">
                    {fechaCorta(l.fechaRecibido)}
                    {l.esInicial ? ' · arranque' : ''}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{l.cantidad}</td>
                  <td className={`px-4 py-2.5 text-right tabular-nums ${agotado ? '' : 'font-bold'}`}>
                    {l.quedan}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {l.esInicial ? (
                      <button
                        type="button"
                        onClick={() => abrirEditorInicial(l)}
                        className="inline-flex items-center gap-1 rounded border border-kolben-line bg-kolben-field px-2 py-0.5 font-bold text-kolben-text hover:border-kolben-ink"
                        title="Corregir FOB del lote Inicial"
                      >
                        {money(l.fobUnidad)} <span className="text-[10px] text-kolben-muted">✎</span>
                      </button>
                    ) : (
                      money(l.fobUnidad)
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{money(l.aduanaUnidad)}</td>
                  <td className="px-4 py-2.5 text-right font-bold tabular-nums">
                    {l.esInicial ? (
                      <button
                        type="button"
                        onClick={() => abrirEditorInicial(l)}
                        className="inline-flex items-center gap-1 rounded border border-kolben-line bg-kolben-field px-2 py-0.5 font-bold text-kolben-text hover:border-kolben-ink"
                        title="Corregir costo del lote Inicial"
                      >
                        {money(l.costoUnidad)} <span className="text-[10px] text-kolben-muted">✎</span>
                      </button>
                    ) : (
                      money(l.costoUnidad)
                    )}
                  </td>
                </tr>
              );
            })}
            {lotesAgotadosAntiguos.length > 0 && (
              <tr className="border-t border-kolben-line bg-kolben-bg/50">
                <td colSpan={7} className="px-4 py-2">
                  <button
                    type="button"
                    onClick={() => setVerAgotadosAntiguos(!verAgotadosAntiguos)}
                    className="text-[11px] font-semibold text-kolben-muted hover:text-kolben-ink"
                  >
                    {anioCorte - 1} y antes · {lotesAgotadosAntiguos.length}{' '}
                    {lotesAgotadosAntiguos.length === 1 ? 'lote agotado' : 'lotes agotados'} ·{' '}
                    {verAgotadosAntiguos ? 'ocultar ▴' : 'ver ▾'}
                  </button>
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Panel en línea: Corregir el costo del lote INICIAL */}
        {editandoInicial && loteInicialFila && (
          <div className="border-t-2 border-kolben-line bg-[#f8f5ec] p-4">
            <div className="grid grid-cols-[1fr_380px] gap-4 items-start">
              <div className="space-y-3">
                <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-kolben-text">
                  Corregir el costo del lote &ldquo;INICIAL&rdquo;
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className={label} htmlFor="li-fob">FOB/u (L)</label>
                    <input
                      id="li-fob"
                      type="number"
                      step="0.01"
                      className={input}
                      value={fobInicial}
                      onChange={(e) => setFobInicial(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className={label} htmlFor="li-costo">Costo/u (L)</label>
                    <input
                      id="li-costo"
                      type="number"
                      step="0.01"
                      className={input}
                      value={costoInicial}
                      onChange={(e) => setCostoInicial(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className={label} htmlFor="li-motivo">Motivo (obligatorio)</label>
                    <input
                      id="li-motivo"
                      className={input}
                      placeholder="costo mal escrito en la carga"
                      value={motivoInicial}
                      onChange={(e) => setMotivoInicial(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-kolben-line bg-white p-4 shadow-sm">
                <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-kolben-muted">
                  Confirmar cambio de costo
                </div>
                <div className="mt-1.5 text-[14px] font-extrabold tabular-nums text-kolben-text">
                  Lote Inicial · L {money(loteInicialFila.costoUnidad)} → L{' '}
                  {money(Number(costoInicial) || 0)}
                </div>
                {Number(fobInicial) !== loteInicialFila.fobUnidad && (
                  <div className="text-[11px] font-semibold tabular-nums text-kolben-muted">
                    FOB/u: L {money(loteInicialFila.fobUnidad)} → L {money(Number(fobInicial) || 0)}
                  </div>
                )}
                <p className="mt-1.5 text-[11px] leading-relaxed text-kolben-muted">
                  Las {loteInicialFila.vendidas} unidades ya vendidas de este lote recalculan su
                  utilidad en el mes de cada venta. Queda en el historial del código.
                </p>
                <div className="mt-3 flex justify-end gap-2">
                  <button
                    type="button"
                    className={btnGhost}
                    onClick={() => setEditandoInicial(false)}
                  >
                    Cancelar
                  </button>
                  <button
                    id="btn-confirmar-lote-inicial"
                    type="button"
                    disabled={guardandoInicial}
                    className={btnDanger}
                    onClick={confirmarCambioInicial}
                  >
                    {guardandoInicial ? 'Guardando…' : 'Sí, cambiar'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* CARD 3: AJUSTES DE STOCK */}
      <section className="overflow-hidden rounded-xl border border-kolben-line bg-kolben-card shadow-sm">
        <div className="flex items-center justify-between border-b border-kolben-line px-4 py-3">
          <h3 className="text-[11px] font-bold uppercase tracking-[0.08em] text-kolben-text">
            Ajustes de stock
          </h3>
          {!abiertoAjuste && (
            <button
              id="btn-abrir-ajuste"
              type="button"
              className={btnGhost}
              onClick={() => {
                setAbiertoAjuste(true);
                setPasoAjuste(1);
                setTipoAjuste('SALE');
                setUnidadesAjuste('1');
                setMotivoAjuste('');
              }}
            >
              ± Ajustar stock
            </button>
          )}
        </div>

        {/* Flujo de 2 pasos en línea para Ajustar Stock */}
        {abiertoAjuste && (
          <div className="border-b border-kolben-line bg-[#f8f5ec] p-4">
            <div className="grid grid-cols-2 gap-4 items-start">
              {/* PASO 1 */}
              <div className="rounded-xl border border-kolben-line bg-white p-4 shadow-sm">
                <div className="mb-3 text-[10px] font-bold uppercase tracking-[0.08em] text-kolben-muted">
                  Paso 1 · Qué cambia
                </div>
                <div className="grid grid-cols-[150px_90px_1fr] gap-3">
                  <div>
                    <label className={label}>Tipo</label>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setTipoAjuste('SALE');
                          setPasoAjuste(1);
                        }}
                        className={`rounded-full border px-3 py-[7px] text-[10px] font-bold uppercase transition ${
                          tipoAjuste === 'SALE'
                            ? 'border-kolben-ink bg-kolben-ink text-white'
                            : 'border-kolben-line text-kolben-muted hover:border-kolben-ink'
                        }`}
                      >
                        − Sale
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setTipoAjuste('ENTRA');
                          setPasoAjuste(1);
                        }}
                        className={`rounded-full border px-3 py-[7px] text-[10px] font-bold uppercase transition ${
                          tipoAjuste === 'ENTRA'
                            ? 'border-kolben-ink bg-kolben-ink text-white'
                            : 'border-kolben-line text-kolben-muted hover:border-kolben-ink'
                        }`}
                      >
                        + Entra
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className={label} htmlFor="aj-unidades">Unidades</label>
                    <input
                      id="aj-unidades"
                      type="number"
                      min={1}
                      step={1}
                      className={input}
                      value={unidadesAjuste}
                      onChange={(e) => {
                        setUnidadesAjuste(e.target.value);
                        setPasoAjuste(1);
                      }}
                    />
                  </div>

                  <div>
                    <label className={label} htmlFor="aj-motivo">Motivo (obligatorio)</label>
                    <input
                      id="aj-motivo"
                      className={input}
                      placeholder="pieza dañada en bodega"
                      value={motivoAjuste}
                      onChange={(e) => {
                        setMotivoAjuste(e.target.value);
                        setPasoAjuste(1);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') continuarPaso2Ajuste();
                      }}
                    />
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between">
                  <span
                    className={`text-[12px] font-bold tabular-nums ${
                      stockProyectado < 0 ? 'text-kolben-red' : 'text-kolben-text'
                    }`}
                  >
                    Stock {p.stock} → {stockProyectado}
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className={btnGhost}
                      onClick={() => setAbiertoAjuste(false)}
                    >
                      Cancelar
                    </button>
                    <button
                      id="btn-continuar-ajuste"
                      type="button"
                      className={btnInk}
                      onClick={continuarPaso2Ajuste}
                    >
                      Continuar
                    </button>
                  </div>
                </div>
              </div>

              {/* PASO 2 */}
              <div
                className={`rounded-xl border border-kolben-line bg-white p-4 shadow-sm transition ${
                  pasoAjuste === 2 ? 'opacity-100' : 'pointer-events-none opacity-45'
                }`}
              >
                <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-kolben-muted">
                  Paso 2 · Confirmar
                </div>
                <div className="mt-1.5 text-[14px] font-extrabold text-kolben-text">
                  ¿{tipoAjuste === 'SALE' ? 'Sacar' : 'Meter'} {uNum}{' '}
                  {uNum === 1 ? 'unidad' : 'unidades'}{' '}
                  {tipoAjuste === 'SALE' ? 'de' : 'a'} {p.codigo}?
                </div>
                <div className="mt-1 text-[11px] font-semibold text-kolben-text">
                  Stock {p.stock} → {stockProyectado} · motivo: {motivoAjuste.trim() || '—'}
                </div>
                <p className="mt-1 text-[11px] text-kolben-muted">
                  No se puede deshacer; si te equivocas, se corrige con otro ajuste.
                </p>
                <div className="mt-3 flex justify-end gap-2">
                  <button
                    type="button"
                    className={btnGhost}
                    onClick={() => setPasoAjuste(1)}
                  >
                    Cancelar
                  </button>
                  <button
                    id="btn-confirmar-ajuste"
                    type="button"
                    disabled={guardandoAjuste || pasoAjuste !== 2}
                    className={btnDanger}
                    onClick={confirmarAjuste}
                  >
                    {guardandoAjuste ? 'Ajustando…' : 'Sí, ajustar'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <table className="w-full border-collapse text-[12px]">
          <thead>
            <tr className="border-b border-kolben-line bg-kolben-bg/40">
              <th className={th}>Fecha</th>
              <th className={`${th} text-right`}>Unidades</th>
              <th className={th}>Motivo</th>
              <th className={`${th} text-right`}>Stock</th>
            </tr>
          </thead>
          <tbody>
            {ajustes.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-kolben-muted">
                  Sin ajustes de stock registrados.
                </td>
              </tr>
            )}
            {ajustes.map((a) => (
              <tr key={a.id} className="border-t border-kolben-line">
                <td className="px-4 py-2.5 text-kolben-text">{fechaCorta(a.fecha)}</td>
                <td
                  className={`px-4 py-2.5 text-right font-bold tabular-nums ${
                    a.unidades < 0 ? 'text-kolben-red' : 'text-kolben-teal'
                  }`}
                >
                  {a.unidades > 0 ? `+${a.unidades}` : a.unidades}
                </td>
                <td className="px-4 py-2.5 text-kolben-text">{a.motivo}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-kolben-muted">
                  {a.stockAntes} → {a.stockDespues}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

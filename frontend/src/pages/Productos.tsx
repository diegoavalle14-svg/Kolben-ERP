import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Pencil, Plus, Upload } from 'lucide-react';
import { api } from '../lib/api';
import FichaCodigo from '../components/FichaCodigo';

/* ───────── Tipos ───────── */
interface Categoria { id: number; nombre: string; orden: number; empaque: number; multiplicador: number }
interface Marca { id: number; nombre: string; orden: number; logoPath: string | null }
interface Fila {
  id: number; codigo: string; descripcion: string; categoriaId: number; marcaId: number;
  marca: string; cbmUnidad: number; fotoPath: string | null; activo: boolean; posicion: number;
  stock: number; apartado: number; disponible: number; valorCosto: number; valorVenta: number;
}
interface Totales { codigos: number; valorCosto: number; valorVenta: number }
interface Grupo { categoria: { id: number; nombre: string; orden: number }; productos: Fila[]; totales: Totales }
interface Datos { grupos: Grupo[]; total: Totales; enArranque?: boolean }
type Vista = 'tabla' | 'listas' | 'ordenar' | 'ficha' | 'form';

const LIMITE_GRUPO = 8;
const money = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const urlImg = (p: string | null) => (p ? `/api/uploads/${p}` : null);

const label = 'block text-[10px] font-semibold uppercase tracking-[0.08em] text-kolben-muted mb-1';
const input =
  'w-full rounded-lg border border-kolben-line bg-kolben-field px-3 py-[9px] text-[13px] font-semibold text-kolben-text outline-none transition focus:border-kolben-ink focus:ring-1 focus:ring-kolben-ink';
const btnGhost =
  'rounded-full border border-kolben-ink px-4 py-[7px] text-[11px] font-bold uppercase tracking-[0.06em] text-kolben-ink transition hover:bg-kolben-ink hover:text-white';
const btnSolid =
  'rounded-full bg-kolben-ink px-4 py-[7px] text-[11px] font-bold uppercase tracking-[0.06em] text-white transition hover:bg-kolben-ink-dark';

export default function Productos() {
  const [vista, setVista] = useState<Vista>('tabla');
  const [datos, setDatos] = useState<Datos | null>(null);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [marcas, setMarcas] = useState<Marca[]>([]);
  const [q, setQ] = useState('');
  const [catSel, setCatSel] = useState(0);
  const [marcaSel, setMarcaSel] = useState(0);
  const [estado, setEstado] = useState('');
  const [expandidos, setExpandidos] = useState<Record<number, boolean>>({});
  const [editando, setEditando] = useState<number | null>(null);
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);

  const flash = useCallback((tipo: 'ok' | 'error', texto: string) => {
    setMsg({ tipo, texto });
    setTimeout(() => setMsg(null), 3500);
  }, []);

  const cargarListas = useCallback(async () => {
    const [c, m] = await Promise.all([
      api<{ categorias: Categoria[] }>('/categorias'),
      api<{ marcas: Marca[] }>('/marcas'),
    ]);
    setCategorias(c.categorias);
    setMarcas(m.marcas);
  }, []);

  const cargar = useCallback(async () => {
    const p = new URLSearchParams();
    if (q.trim()) p.set('q', q.trim());
    if (catSel) p.set('categoriaId', String(catSel));
    if (marcaSel) p.set('marcaId', String(marcaSel));
    if (estado) p.set('estado', estado);
    try {
      setDatos(await api<Datos>(`/productos?${p}`));
    } catch (e) {
      flash('error', (e as Error).message);
    }
  }, [q, catSel, marcaSel, estado, flash]);

  useEffect(() => { cargarListas().catch((e) => flash('error', e.message)); }, [cargarListas, flash]);
  useEffect(() => {
    const t = setTimeout(cargar, 180);
    return () => clearTimeout(t);
  }, [cargar]);

  const recargarTodo = async () => { await Promise.all([cargarListas(), cargar()]); };

  return (
    <div className="space-y-3 pb-10">
      {msg && (
        <div
          role="status"
          className={`rounded-lg border p-3 text-xs font-semibold ${
            msg.tipo === 'ok' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-rose-200 bg-rose-50 text-rose-800'
          }`}
        >
          {msg.texto}
        </div>
      )}

      {vista === 'tabla' && (
        <>
          <div className="flex items-center justify-end gap-2">
            <button id="btn-ordenar" className={btnGhost} onClick={() => setVista('ordenar')}>↑↓ Ordenar</button>
            <button id="btn-listas" className={btnGhost} onClick={() => setVista('listas')}>Listas</button>
            <button id="btn-nuevo-codigo" className={btnSolid} onClick={() => { setEditando(null); setVista('form'); }}>+ Nuevo código</button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              id="prod-buscar"
              className={`${input} !w-[300px]`}
              placeholder='buscar código, Hilux, 15/16"…'
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <div className="flex gap-1.5">
              {[{ id: 0, nombre: 'Todas' }, ...categorias].map((c) => (
                <button
                  key={c.id}
                  onClick={() => setCatSel(c.id)}
                  className={`rounded-full border px-3 py-[6px] text-[10px] font-bold uppercase tracking-[0.06em] transition ${
                    catSel === c.id
                      ? 'border-kolben-ink bg-kolben-ink text-white'
                      : 'border-kolben-line bg-kolben-card text-kolben-muted hover:border-kolben-ink'
                  }`}
                >
                  {c.nombre}
                </button>
              ))}
            </div>
            <select className={`${input} !w-auto`} value={marcaSel} onChange={(e) => setMarcaSel(Number(e.target.value))}>
              <option value={0}>Marca: todas</option>
              {marcas.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
            </select>
            <select className={`${input} !w-auto`} value={estado} onChange={(e) => setEstado(e.target.value)}>
              <option value="">Todos</option>
              <option value="activo">Activos</option>
              <option value="inactivo">Inactivos</option>
              <option value="sin-stock">Sin disponible</option>
            </select>
          </div>

          <Tabla
            datos={datos}
            expandidos={expandidos}
            setExpandidos={setExpandidos}
            onEditar={(id) => { setEditando(id); setVista('ficha'); }}
            onMover={async (id, dir) => {
              try {
                await api(`/productos/${id}/mover`, { method: 'POST', body: JSON.stringify({ dir }) });
                await cargar();
              } catch (e) {
                flash('error', (e as Error).message);
              }
            }}
          />
        </>
      )}

      {vista === 'ficha' && editando !== null && (
        <FichaCodigo
          id={editando}
          onVolver={() => { setEditando(null); setVista('tabla'); }}
          onEditarDatos={(id) => { setEditando(id); setVista('form'); }}
          onCambioStock={cargar}
          flash={flash}
        />
      )}

      {vista === 'listas' && (
        <Listas categorias={categorias} marcas={marcas} onCambio={recargarTodo} onVolver={() => { setVista('tabla'); cargar(); }} flash={flash} />
      )}

      {vista === 'ordenar' && datos && (
        <Ordenar
          datos={datos}
          marcas={marcas}
          onCancelar={() => setVista('tabla')}
          onGuardado={async () => { flash('ok', 'Orden guardado'); await cargar(); setVista('tabla'); }}
          flash={flash}
        />
      )}

      {vista === 'form' && (
        <Formulario
          id={editando}
          categorias={categorias}
          marcas={marcas}
          enArranque={datos?.enArranque ?? true}
          onCancelar={() => setVista(editando !== null ? 'ficha' : 'tabla')}
          onGuardado={async (t) => {
            flash('ok', t);
            await cargar();
            if (t === 'Código eliminado' || editando === null) {
              setEditando(null);
              setVista('tabla');
            } else {
              setVista('ficha');
            }
          }}
          flash={flash}
        />
      )}
    </div>
  );
}

/* ───────── Tabla ───────── */
function Tabla({
  datos, expandidos, setExpandidos, onEditar, onMover,
}: {
  datos: Datos | null;
  expandidos: Record<number, boolean>;
  setExpandidos: (v: Record<number, boolean>) => void;
  onEditar: (id: number) => void;
  onMover: (id: number, dir: 'up' | 'down') => void;
}) {
  if (!datos) return <div className="p-6 text-sm text-kolben-muted">Cargando productos...</div>;
  const th = 'px-3 py-2 text-left text-[9px] font-semibold uppercase tracking-[0.08em] text-kolben-muted';
  return (
    <div className="overflow-hidden rounded-xl border border-kolben-line bg-kolben-card shadow-sm">
      <table className="w-full border-collapse text-[12px]">
        <thead>
          <tr className="border-b border-kolben-line">
            <th className="w-9 px-2 py-2" />
            <th className={th}>Foto</th>
            <th className={th}>Código</th>
            <th className={th}>Descripción</th>
            <th className={th}>Marca</th>
            <th className={`${th} text-right`}>Stock</th>
            <th className={`${th} text-right`}>Disponible</th>
            <th className={`${th} text-right`}>Valor a costo (L)</th>
            <th className={`${th} text-right`}>Valor a precio de venta (L)</th>
            <th className={th}>Estado · Catálogo</th>
          </tr>
        </thead>
        <tbody>
          {datos.grupos.length === 0 && (
            <tr><td colSpan={10} className="p-8 text-center text-kolben-muted">No hay códigos con esos filtros.</td></tr>
          )}
          {datos.grupos.map((g) => {
            const abierto = expandidos[g.categoria.id];
            const visibles = abierto ? g.productos : g.productos.slice(0, LIMITE_GRUPO);
            return (
              <GrupoFilas key={g.categoria.id}>
                <tr className="bg-kolben-bg/70">
                  <td colSpan={7} className="px-3 py-2 text-[11px] font-bold uppercase tracking-[0.06em] text-kolben-ink">
                    {g.categoria.orden} · {g.categoria.nombre}
                    <span className="ml-2 font-medium normal-case tracking-normal text-kolben-muted">{g.totales.codigos} códigos</span>
                  </td>
                  <td className="px-3 py-2 text-right font-bold tabular-nums">{money(g.totales.valorCosto)}</td>
                  <td className="px-3 py-2 text-right font-bold tabular-nums text-kolben-teal">{money(g.totales.valorVenta)}</td>
                  <td />
                </tr>
                {visibles.map((p) => {
                  const sinStock = p.stock === 0;
                  return (
                    <tr
                      key={p.id}
                      onClick={() => onEditar(p.id)}
                      className="cursor-pointer border-t border-kolben-line transition hover:bg-white"
                    >
                      <td className="px-2 py-1.5" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center text-kolben-muted">
                          <button
                            type="button"
                            title="Subir en su marca"
                            onClick={() => onMover(p.id, 'up')}
                            className="rounded p-0.5 hover:bg-kolben-bg hover:text-kolben-ink"
                          >
                            <ArrowUp size={12} />
                          </button>
                          <button
                            type="button"
                            title="Bajar en su marca"
                            onClick={() => onMover(p.id, 'down')}
                            className="rounded p-0.5 hover:bg-kolben-bg hover:text-kolben-ink"
                          >
                            <ArrowDown size={12} />
                          </button>
                        </div>
                      </td>
                      <td className="px-3 py-1.5">
                        {p.fotoPath ? (
                          <img src={urlImg(p.fotoPath)!} alt={p.codigo} className="h-9 w-9 rounded-md object-cover" />
                        ) : (
                          <div className="flex h-9 w-9 items-center justify-center rounded-md border border-dashed border-kolben-ink-soft text-[7px] text-kolben-muted">
                            sin foto
                          </div>
                        )}
                      </td>
                      <td className={`px-3 py-1.5 font-bold ${sinStock ? 'text-kolben-muted' : 'text-kolben-text'}`}>{p.codigo}</td>
                      <td className="max-w-[240px] px-3 py-1.5 text-kolben-muted">{p.descripcion.split('\n').join(' · ')}</td>
                      <td className="px-3 py-1.5 font-semibold">{p.marca}</td>
                      <td className={`px-3 py-1.5 text-right font-bold tabular-nums ${sinStock ? 'text-kolben-red' : ''}`}>{p.stock}</td>
                      <td className={`px-3 py-1.5 text-right tabular-nums ${sinStock ? 'text-kolben-red' : ''}`}>{p.disponible}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{sinStock ? '—' : money(p.valorCosto)}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums text-kolben-teal">{sinStock ? '—' : money(p.valorVenta)}</td>
                      <td className="px-3 py-1.5">
                        <span className={`text-[10px] font-bold uppercase ${p.activo ? 'text-kolben-teal' : 'text-kolben-muted'}`}>
                          {p.activo ? 'Activo' : 'Inactivo'}
                        </span>
                        <span className="ml-1.5 text-[10px] text-kolben-muted">
                          {p.activo && p.disponible > 0 ? '✓ sale' : `no sale · ${!p.activo ? 'inactivo' : 'sin disponible'}`}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {g.productos.length > LIMITE_GRUPO && (
                  <tr className="border-t border-kolben-line">
                    <td colSpan={10} className="px-3 py-1.5">
                      <button
                        className="text-[11px] font-semibold text-kolben-ink hover:underline"
                        onClick={() => setExpandidos({ ...expandidos, [g.categoria.id]: !abierto })}
                      >
                        {abierto ? 'ver menos' : `+ ${g.productos.length - LIMITE_GRUPO} códigos más`}
                      </button>
                    </td>
                  </tr>
                )}
              </GrupoFilas>
            );
          })}
          <tr className="border-t-2 border-kolben-line bg-[#f3ecd9]">
            <td colSpan={7} className="px-3 py-2.5 text-[11px] font-bold uppercase tracking-[0.06em]">
              Total inventario <span className="ml-2 font-medium normal-case tracking-normal text-kolben-muted">· va al Resumen</span>
            </td>
            <td className="px-3 py-2.5 text-right font-bold tabular-nums">{money(datos.total.valorCosto)}</td>
            <td className="px-3 py-2.5 text-right font-bold tabular-nums text-kolben-teal">{money(datos.total.valorVenta)}</td>
            <td />
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function GrupoFilas({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

/* ───────── Listas (categorías y marcas) ───────── */
function Listas({
  categorias, marcas, onCambio, onVolver, flash,
}: {
  categorias: Categoria[]; marcas: Marca[];
  onCambio: () => Promise<void>; onVolver: () => void;
  flash: (t: 'ok' | 'error', s: string) => void;
}) {
  const [nuevaCat, setNuevaCat] = useState('');
  const [nuevaMarca, setNuevaMarca] = useState('');
  const [editCat, setEditCat] = useState<number | null>(null);
  const [editNombre, setEditNombre] = useState('');
  const [editEmpaque, setEditEmpaque] = useState(10);
  const [editMult, setEditMult] = useState('');
  const [editMarca, setEditMarca] = useState<number | null>(null);
  const [logoPara, setLogoPara] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const run = async (fn: () => Promise<unknown>, ok?: string) => {
    try { await fn(); await onCambio(); if (ok) flash('ok', ok); } catch (e) { flash('error', (e as Error).message); }
  };

  const subirLogo = (f: File) =>
    run(async () => {
      const fd = new FormData();
      fd.append('logo', f);
      await api(`/marcas/${logoPara}/logo`, { method: 'POST', body: fd });
    }, 'Logo actualizado');

  const flecha = 'rounded p-1 text-kolben-muted transition hover:bg-kolben-bg hover:text-kolben-ink';

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.08em]">Listas <span className="font-normal normal-case tracking-normal text-kolben-muted">· categorías y marcas, en el orden en que se muestran</span></h2>
        <button id="btn-volver-listas" className={btnSolid} onClick={onVolver}>Listo</button>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <section className="rounded-xl border border-kolben-line bg-kolben-card p-5 shadow-sm">
          <div className="mb-3 text-[11px] font-bold uppercase tracking-[0.08em]">Categorías</div>
          <ul className="space-y-1.5">
            {categorias.map((c, i) => (
              <li key={c.id} className="flex items-center gap-2 rounded-lg border border-kolben-line bg-kolben-field px-3 py-2">
                <span className="w-5 text-[12px] font-bold text-kolben-ink-soft tabular-nums">{i + 1}</span>
                {editCat === c.id ? (
                  <>
                    <input className={`${input} !py-1`} value={editNombre} onChange={(e) => setEditNombre(e.target.value)} />
                    <select
                      className={`${input} !w-24 !py-1`}
                      title="Empaque de fábrica (10 / 20 / 50)"
                      value={editEmpaque}
                      onChange={(e) => setEditEmpaque(Number(e.target.value))}
                    >
                      <option value={10}>10 u</option>
                      <option value={20}>20 u</option>
                      <option value={50}>50 u</option>
                    </select>
                    <input
                      className={`${input} !w-20 !py-1`}
                      title="Multiplicador sobre FOB (valor a precio de venta)"
                      value={editMult}
                      onChange={(e) => setEditMult(e.target.value)}
                    />
                    <button
                      className={btnSolid}
                      onClick={() => run(async () => {
                        await api(`/categorias/${c.id}`, {
                          method: 'PUT',
                          body: JSON.stringify({ nombre: editNombre, empaque: editEmpaque, multiplicador: Number(editMult) }),
                        });
                        setEditCat(null);
                      })}
                    >OK</button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 text-[13px] font-semibold">{c.nombre}</span>
                    <span className="text-[10px] text-kolben-muted" title="Empaque de fábrica">caja {c.empaque ?? 10}</span>
                    <span className="text-[10px] text-kolben-muted" title="Multiplicador sobre FOB">× {c.multiplicador}</span>
                    <button className={flecha} aria-label="Subir" onClick={() => run(() => api(`/categorias/${c.id}/mover`, { method: 'POST', body: JSON.stringify({ dir: 'up' }) }))}><ArrowUp size={14} /></button>
                    <button className={flecha} aria-label="Bajar" onClick={() => run(() => api(`/categorias/${c.id}/mover`, { method: 'POST', body: JSON.stringify({ dir: 'down' }) }))}><ArrowDown size={14} /></button>
                    <button className={flecha} aria-label="Editar" onClick={() => { setEditCat(c.id); setEditNombre(c.nombre); setEditEmpaque(c.empaque ?? 10); setEditMult(String(c.multiplicador)); }}><Pencil size={14} /></button>
                  </>
                )}
              </li>
            ))}
          </ul>
          <form
            className="mt-3 flex gap-2"
            onSubmit={(e) => { e.preventDefault(); if (!nuevaCat.trim()) return; run(async () => { await api('/categorias', { method: 'POST', body: JSON.stringify({ nombre: nuevaCat }) }); setNuevaCat(''); }); }}
          >
            <input className={input} placeholder="nueva categoría" value={nuevaCat} onChange={(e) => setNuevaCat(e.target.value)} />
            <button className={btnGhost} type="submit"><Plus size={12} className="inline" /> Agregar</button>
          </form>
        </section>

        <section className="rounded-xl border border-kolben-line bg-kolben-card p-5 shadow-sm">
          <div className="mb-3 text-[11px] font-bold uppercase tracking-[0.08em]">Marcas</div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) subirLogo(f); e.target.value = ''; }} />
          <ul className="space-y-1.5">
            {marcas.map((m, i) => (
              <li key={m.id} className="flex items-center gap-2 rounded-lg border border-kolben-line bg-kolben-field px-3 py-2">
                <span className="w-5 text-[12px] font-bold text-kolben-ink-soft tabular-nums">{i + 1}</span>
                <button
                  title="Cambiar logo"
                  onClick={() => { setLogoPara(m.id); fileRef.current?.click(); }}
                  className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-md border border-dashed border-kolben-ink-soft bg-white text-kolben-muted hover:border-kolben-ink"
                >
                  {m.logoPath ? <img src={urlImg(m.logoPath)!} alt={m.nombre} className="h-full w-full object-contain" /> : <Upload size={12} />}
                </button>
                {editMarca === m.id ? (
                  <input
                    autoFocus
                    className={`${input} !py-1`}
                    defaultValue={m.nombre}
                    onKeyDown={(e) => { if (e.key === 'Escape') setEditMarca(null); }}
                    onBlur={(e) => { const v = e.target.value.trim(); setEditMarca(null); if (v && v !== m.nombre) run(() => api(`/marcas/${m.id}`, { method: 'PUT', body: JSON.stringify({ nombre: v }) })); }}
                  />
                ) : (
                  <span className="flex-1 text-[13px] font-semibold">{m.nombre}</span>
                )}
                <button className={flecha} aria-label="Subir" onClick={() => run(() => api(`/marcas/${m.id}/mover`, { method: 'POST', body: JSON.stringify({ dir: 'up' }) }))}><ArrowUp size={14} /></button>
                <button className={flecha} aria-label="Bajar" onClick={() => run(() => api(`/marcas/${m.id}/mover`, { method: 'POST', body: JSON.stringify({ dir: 'down' }) }))}><ArrowDown size={14} /></button>
                <button className={flecha} aria-label="Editar" onClick={() => setEditMarca(m.id)}><Pencil size={14} /></button>
              </li>
            ))}
          </ul>
          <form
            className="mt-3 flex gap-2"
            onSubmit={(e) => { e.preventDefault(); if (!nuevaMarca.trim()) return; run(async () => { await api('/marcas', { method: 'POST', body: JSON.stringify({ nombre: nuevaMarca }) }); setNuevaMarca(''); }); }}
          >
            <input className={input} placeholder="nueva marca" value={nuevaMarca} onChange={(e) => setNuevaMarca(e.target.value)} />
            <button className={btnGhost} type="submit"><Plus size={12} className="inline" /> Agregar</button>
          </form>
        </section>
      </div>
    </div>
  );
}

/* ───────── Ordenar ───────── */
interface ItemOrden { id: number; codigo: string; descripcion: string; pos: number; original: number }

function Ordenar({
  datos, marcas, onCancelar, onGuardado, flash,
}: {
  datos: Datos; marcas: Marca[];
  onCancelar: () => void; onGuardado: () => Promise<void>;
  flash: (t: 'ok' | 'error', s: string) => void;
}) {
  // Un bloque por categoría + marca, cada uno con su propia numeración
  const inicial = useMemo(() => {
    const bloques: { clave: string; titulo: string; items: ItemOrden[] }[] = [];
    for (const g of datos.grupos) {
      for (const m of marcas) {
        const items = g.productos
          .filter((p) => p.marcaId === m.id)
          .sort((a, b) => a.posicion - b.posicion)
          .map((p, i) => ({ id: p.id, codigo: p.codigo, descripcion: p.descripcion, pos: i + 1, original: i + 1 }));
        if (items.length) bloques.push({ clave: `${g.categoria.id}:${m.id}`, titulo: `${g.categoria.orden} · ${g.categoria.nombre} · ${m.nombre} · ${items.length} códigos`, items });
      }
    }
    return bloques;
  }, [datos, marcas]);
  const [bloques, setBloques] = useState(inicial);

  const renumerar = (items: ItemOrden[]) => items.map((it, i) => ({ ...it, pos: i + 1 }));
  const mover = (clave: string, idx: number, d: -1 | 1) =>
    setBloques(bloques.map((b) => {
      if (b.clave !== clave) return b;
      const j = idx + d;
      if (j < 0 || j >= b.items.length) return b;
      const items = [...b.items];
      [items[idx], items[j]] = [items[j], items[idx]];
      return { ...b, items: renumerar(items) };
    }));
  const fijarPos = (clave: string, idx: number, valor: number) =>
    setBloques(bloques.map((b) => {
      if (b.clave !== clave || !valor) return b;
      const destino = Math.max(1, Math.min(b.items.length, valor)) - 1;
      const items = [...b.items];
      const [it] = items.splice(idx, 1);
      items.splice(destino, 0, it);
      return { ...b, items: renumerar(items) };
    }));

  const guardar = async () => {
    try {
      const items = bloques.flatMap((b) => b.items.map((it) => ({ id: it.id, posicion: it.pos })));
      await api('/productos/orden', { method: 'POST', body: JSON.stringify({ items }) });
      await onGuardado();
    } catch (e) { flash('error', (e as Error).message); }
  };

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.08em]">
          Ordenar <span className="font-normal normal-case tracking-normal text-kolben-muted">· cada categoría y marca con su propia numeración</span>
        </h2>
        <div className="flex gap-2">
          <button id="btn-cancelar-orden" className={btnGhost} onClick={onCancelar}>Cancelar</button>
          <button id="btn-guardar-orden" className={btnSolid} onClick={guardar}>Guardar</button>
        </div>
      </div>
      <div className="space-y-3">
        {bloques.map((b) => (
          <section key={b.clave} className="overflow-hidden rounded-xl border border-kolben-line bg-kolben-card shadow-sm">
            <div className="bg-kolben-bg/70 px-3 py-2 text-[11px] font-bold uppercase tracking-[0.06em] text-kolben-ink">{b.titulo}</div>
            {b.items.map((it, idx) => (
              <div key={it.id} className="flex items-center gap-3 border-t border-kolben-line px-3 py-1.5">
                <input
                  aria-label={`Posición de ${it.codigo}`}
                  className={`h-8 w-12 rounded-md border text-center text-[12px] font-bold tabular-nums outline-none focus:border-kolben-ink ${
                    it.pos !== it.original ? 'border-kolben-orange bg-[#f3ecd9]' : 'border-kolben-line bg-kolben-field'
                  }`}
                  defaultValue={it.pos}
                  key={`${it.id}-${it.pos}`}
                  onBlur={(e) => { const v = Number(e.target.value); if (v !== it.pos) fijarPos(b.clave, idx, v); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                />
                <div className="flex">
                  <button className="rounded p-1 text-kolben-muted hover:text-kolben-ink" aria-label="Subir" onClick={() => mover(b.clave, idx, -1)}><ArrowUp size={14} /></button>
                  <button className="rounded p-1 text-kolben-muted hover:text-kolben-ink" aria-label="Bajar" onClick={() => mover(b.clave, idx, 1)}><ArrowDown size={14} /></button>
                </div>
                <span className="w-24 text-[12px] font-bold">{it.codigo}</span>
                <span className="text-[12px] text-kolben-muted">{it.descripcion.split('\n').join(' · ')}</span>
              </div>
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}

/* ───────── Formulario Nuevo / Editar código ───────── */
function Formulario({
  id, categorias, marcas, enArranque, onCancelar, onGuardado, flash,
}: {
  id: number | null; categorias: Categoria[]; marcas: Marca[]; enArranque: boolean;
  onCancelar: () => void; onGuardado: (t: string) => Promise<void>;
  flash: (t: 'ok' | 'error', s: string) => void;
}) {
  const nuevo = id === null;
  const [f, setF] = useState({
    codigo: '', categoriaId: 0, marcaId: 0, cbmUnidad: '0.030', activo: true,
    descripcion: '', posicion: '', stockInicial: '0', fobUnidad: '0', costoUnidad: '0',
  });
  const [foto, setFoto] = useState<File | null>(null);
  const [fotoActual, setFotoActual] = useState<string | null>(null);
  const [previa, setPrevia] = useState<string | null>(null);
  const [totalGrupo, setTotalGrupo] = useState(0);
  const [guardando, setGuardando] = useState(false);
  const [confirmandoEliminar, setConfirmandoEliminar] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (nuevo) {
      setF((x) => ({ ...x, categoriaId: x.categoriaId || categorias[0]?.id || 0, marcaId: x.marcaId || marcas[0]?.id || 0 }));
      return;
    }
    api<{ producto: Fila }>(`/productos/${id}`)
      .then(({ producto: p }) => {
        setF((x) => ({
          ...x, codigo: p.codigo, categoriaId: p.categoriaId, marcaId: p.marcaId,
          cbmUnidad: String(p.cbmUnidad), activo: p.activo, descripcion: p.descripcion, posicion: String(p.posicion),
        }));
        setFotoActual(p.fotoPath);
      })
      .catch((e) => flash('error', e.message));
  }, [id, nuevo, categorias, marcas, flash]);

  // Cantidad de códigos en el grupo (para "posición de N")
  useEffect(() => {
    if (!f.categoriaId || !f.marcaId) return;
    api<Datos>(`/productos?categoriaId=${f.categoriaId}&marcaId=${f.marcaId}`)
      .then((d) => setTotalGrupo(d.total.codigos))
      .catch(() => {});
  }, [f.categoriaId, f.marcaId]);

  useEffect(() => {
    if (!foto) { setPrevia(null); return; }
    const u = URL.createObjectURL(foto);
    setPrevia(u);
    return () => URL.revokeObjectURL(u);
  }, [foto]);

  const cat = categorias.find((c) => c.id === f.categoriaId);
  const marca = marcas.find((m) => m.id === f.marcaId);
  const lineas = f.descripcion.split('\n').map((l) => l.trim()).filter(Boolean);
  const set = (k: keyof typeof f, v: string | boolean | number) => setF((x) => ({ ...x, [k]: v }));

  const guardar = async () => {
    setGuardando(true);
    try {
      const body: Record<string, unknown> = {
        codigo: f.codigo, categoriaId: f.categoriaId, marcaId: f.marcaId, descripcion: f.descripcion,
        cbmUnidad: f.cbmUnidad || 0, activo: f.activo,
        ...(f.posicion ? { posicion: Number(f.posicion) } : {}),
      };
      let pid = id;
      if (nuevo) {
        Object.assign(body, { stockInicial: f.stockInicial || 0, fobUnidad: f.fobUnidad || 0, costoUnidad: f.costoUnidad || 0 });
        const r = await api<{ producto: { id: number } }>('/productos', { method: 'POST', body: JSON.stringify(body) });
        pid = r.producto.id;
      } else {
        await api(`/productos/${id}`, { method: 'PUT', body: JSON.stringify(body) });
      }
      if (foto && pid) {
        const fd = new FormData();
        fd.append('foto', foto);
        await api(`/productos/${pid}/foto`, { method: 'POST', body: fd });
      }
      await onGuardado(nuevo ? 'Código creado' : 'Código guardado');
    } catch (e) {
      flash('error', (e as Error).message);
    } finally {
      setGuardando(false);
    }
  };

  const eliminar = async () => {
    try {
      await api(`/productos/${id}`, { method: 'DELETE' });
      await onGuardado('Código eliminado');
    } catch (e) { flash('error', (e as Error).message); }
  };

  const fotoMostrar = previa ?? urlImg(fotoActual);
  const posMax = nuevo ? totalGrupo + 1 : totalGrupo;

  return (
    <section className="rounded-xl border border-kolben-line bg-kolben-card p-6 shadow-sm">
      <h2 className="mb-4 text-[11px] font-bold uppercase tracking-[0.08em]">{nuevo ? 'Nuevo código' : `Código ${f.codigo}`}</h2>

      <div className="grid grid-cols-[130px_1fr] gap-6">
        <div>
          <div className="flex h-[110px] w-[110px] items-center justify-center overflow-hidden rounded-xl border border-dashed border-kolben-ink-soft bg-kolben-field text-[10px] text-kolben-muted">
            {fotoMostrar ? <img src={fotoMostrar} alt="Foto" className="h-full w-full object-cover" /> : 'sin foto'}
          </div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => setFoto(e.target.files?.[0] ?? null)} />
          <button className="mt-2 text-[11px] font-semibold text-kolben-ink hover:underline" onClick={() => fileRef.current?.click()}>↑ cambiar foto</button>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-4 gap-3">
            <div>
              <label className={label} htmlFor="pf-codigo">Código</label>
              <input id="pf-codigo" className={input} value={f.codigo} onChange={(e) => set('codigo', e.target.value)} />
              <div className="mt-1 text-[10px] text-kolben-muted">único · el mismo que usa la fábrica</div>
            </div>
            <div>
              <label className={label} htmlFor="pf-cat">Categoría</label>
              <select id="pf-cat" className={input} value={f.categoriaId} onChange={(e) => set('categoriaId', Number(e.target.value))}>
                {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className={label} htmlFor="pf-marca">Marca</label>
              <select id="pf-marca" className={input} value={f.marcaId} onChange={(e) => set('marcaId', Number(e.target.value))}>
                {marcas.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className={label} htmlFor="pf-cbm">CBM por unidad</label>
              <input id="pf-cbm" className={input} value={f.cbmUnidad} onChange={(e) => set('cbmUnidad', e.target.value)} />
              <div className="mt-1 text-[10px] text-kolben-muted">para repartir gastos al recibir</div>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-3">
            <div>
              <label className={label}>Estado</label>
              <div className="flex gap-1.5">
                {[true, false].map((v) => (
                  <button
                    key={String(v)}
                    type="button"
                    onClick={() => set('activo', v)}
                    className={`rounded-full border px-3 py-[7px] text-[10px] font-bold uppercase tracking-[0.06em] transition ${
                      f.activo === v ? 'border-kolben-ink bg-kolben-ink text-white' : 'border-kolben-line text-kolben-muted hover:border-kolben-ink'
                    }`}
                  >
                    {v ? 'Activo' : 'Inactivo'}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className={label} htmlFor="pf-pos">Posición</label>
              <input id="pf-pos" className={input} placeholder={String(posMax)} value={f.posicion} onChange={(e) => set('posicion', e.target.value)} />
              <div className="mt-1 text-[10px] text-kolben-muted">de {posMax || 1} en {cat?.nombre} · {marca?.nombre}</div>
            </div>
          </div>

          <div>
            <label className={label} htmlFor="pf-desc">Descripción</label>
            <textarea id="pf-desc" rows={3} className={input} value={f.descripcion} onChange={(e) => set('descripcion', e.target.value)} />
            <div className="mt-1 text-[10px] text-kolben-muted">una línea por cosa · Enter para bajar · texto libre, se escribe a mano</div>
          </div>

          {nuevo && enArranque && (
            <div className="rounded-xl border border-kolben-line bg-[#f3ecd9] p-4">
              <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.08em]">Solo en arranque <span className="font-normal normal-case tracking-normal text-kolben-muted">· crea el lote Inicial</span></div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className={label} htmlFor="pf-stock">Stock inicial (u)</label>
                  <input id="pf-stock" className={input} value={f.stockInicial} onChange={(e) => set('stockInicial', e.target.value)} />
                  <div className="mt-1 text-[10px] text-kolben-muted">unidades en bodega hoy</div>
                </div>
                <div>
                  <label className={label} htmlFor="pf-fob">FOB por unidad (L)</label>
                  <input id="pf-fob" className={input} value={f.fobUnidad} onChange={(e) => set('fobUnidad', e.target.value)} />
                  <div className="mt-1 text-[10px] text-kolben-muted">para el multiplicador</div>
                </div>
                <div>
                  <label className={label} htmlFor="pf-costo">Costo por unidad (L)</label>
                  <input id="pf-costo" className={input} value={f.costoUnidad} onChange={(e) => set('costoUnidad', e.target.value)} />
                  <div className="mt-1 text-[10px] text-kolben-muted">FOB + aduana</div>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-kolben-line bg-kolben-field p-3">
              <div className="mb-1 text-[9px] font-semibold uppercase tracking-[0.08em] text-kolben-muted">En el POS y reportes</div>
              <div className="text-[12px] font-semibold">{f.codigo || '—'} · {lineas.join(' · ') || '—'}</div>
            </div>
            <div className="rounded-xl border border-kolben-line bg-kolben-field p-3">
              <div className="mb-1 text-[9px] font-semibold uppercase tracking-[0.08em] text-kolben-muted">En el catálogo</div>
              <ul className="text-[11px] font-semibold uppercase">
                {lineas.length ? lineas.map((l, i) => <li key={i}>• {l}</li>) : <li>—</li>}
              </ul>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 flex items-center justify-between border-t border-kolben-line pt-4">
        {nuevo ? <span /> : confirmandoEliminar ? (
          <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs">
            <span className="font-semibold text-rose-800">¿Eliminar el código {f.codigo}? No se puede deshacer.</span>
            <button type="button" className="rounded bg-rose-600 px-2.5 py-1 text-[10px] font-bold uppercase text-white hover:bg-rose-700" onClick={eliminar}>Sí, eliminar</button>
            <button type="button" className="rounded px-2 py-1 text-[10px] font-bold uppercase text-kolben-muted hover:text-kolben-text" onClick={() => setConfirmandoEliminar(false)}>Cancelar</button>
          </div>
        ) : (
          <button type="button" className="text-[11px] font-bold uppercase tracking-[0.06em] text-kolben-red hover:underline" onClick={() => setConfirmandoEliminar(true)}>
            Eliminar <span className="font-normal normal-case tracking-normal text-kolben-muted">· solo si nunca tuvo ventas, lotes ni pedidos</span>
          </button>
        )}
        <div className="flex gap-2">
          <button id="btn-cancelar-form" className={btnGhost} onClick={onCancelar}>Cancelar</button>
          <button id="btn-guardar-codigo" className={btnSolid} onClick={guardar} disabled={guardando}>{guardando ? 'Guardando…' : nuevo ? 'Crear código' : 'Guardar'}</button>
        </div>
      </div>
    </section>
  );
}

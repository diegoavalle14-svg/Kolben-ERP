import { useEffect, useState } from 'react';
import { Save, Plus, Trash2, Landmark, CheckCircle2 } from 'lucide-react';
import { api } from '../lib/api';

interface Config {
  vendedor: string;
  contacto: string;
  titularCheques: string | null;
  porcentajeIsv: string | number;
  correoRespaldo: string | null;
  diaRespaldo: number;
  pctMesSinStock: string | number;
}
interface Banco { id: number; nombre: string; cuentaEnmascarada: string; orden: number }

const input =
  'w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition';
const label = 'block text-xs font-semibold text-slate-600 mb-1';

export default function Configuracion() {
  const [config, setConfig] = useState<Config | null>(null);
  const [bancos, setBancos] = useState<Banco[]>([]);
  const [nuevoBanco, setNuevoBanco] = useState({ nombre: '', cuentaEnmascarada: '' });
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);

  const cargar = () =>
    api<{ config: Config; bancos: Banco[] }>('/config')
      .then((d) => { setConfig(d.config); setBancos(d.bancos); })
      .catch((e) => setMsg({ tipo: 'error', texto: e.message }));

  useEffect(() => { cargar(); }, []);

  const flash = (tipo: 'ok' | 'error', texto: string) => {
    setMsg({ tipo, texto });
    setTimeout(() => setMsg(null), 3000);
  };

  const guardar = async () => {
    if (!config) return;
    try {
      await api('/config', { method: 'PUT', body: JSON.stringify(config) });
      flash('ok', 'Configuración guardada');
    } catch (e) { flash('error', (e as Error).message); }
  };

  const agregarBanco = async () => {
    if (!nuevoBanco.nombre || !nuevoBanco.cuentaEnmascarada) return;
    try {
      await api('/config/bancos', { method: 'POST', body: JSON.stringify(nuevoBanco) });
      setNuevoBanco({ nombre: '', cuentaEnmascarada: '' });
      cargar();
    } catch (e) { flash('error', (e as Error).message); }
  };

  const eliminarBanco = async (id: number) => {
    if (!confirm('¿Eliminar este banco?')) return;
    await api(`/config/bancos/${id}`, { method: 'DELETE' }).catch((e) => flash('error', e.message));
    cargar();
  };

  if (!config) return <div className="p-8 text-sm text-slate-500">Cargando configuración...</div>;

  const set = <K extends keyof Config>(k: K, v: Config[K]) => setConfig({ ...config, [k]: v });

  return (
    <div className="p-8">
      <header className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Configuración</h1>
          <p className="text-sm text-slate-500">Parámetros generales del sistema</p>
        </div>
        <button id="btn-guardar-config" onClick={guardar}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold transition">
          <Save className="w-4 h-4" /> Guardar cambios
        </button>
      </header>

      {msg && (
        <div className={`mb-4 flex items-center gap-2 text-sm rounded-lg p-3 border ${
          msg.tipo === 'ok' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-rose-50 border-rose-200 text-rose-700'}`}>
          {msg.tipo === 'ok' && <CheckCircle2 className="w-4 h-4" />} {msg.texto}
        </div>
      )}

      <div className="grid grid-cols-2 gap-6">
        <section className="border border-slate-200 rounded-xl p-6">
          <h2 className="font-semibold text-slate-800 mb-4">Vendedor y documentos</h2>
          <div className="space-y-4">
            <div><label className={label}>Vendedor</label>
              <input id="cfg-vendedor" className={input} value={config.vendedor} onChange={(e) => set('vendedor', e.target.value)} /></div>
            <div><label className={label}>Contacto (teléfono / correo)</label>
              <input id="cfg-contacto" className={input} value={config.contacto} onChange={(e) => set('contacto', e.target.value)} /></div>
            <div><label className={label}>Titular de cheques</label>
              <input id="cfg-titular" className={input} value={config.titularCheques ?? ''} onChange={(e) => set('titularCheques', e.target.value)} /></div>
            <div><label className={label}>% ISV</label>
              <input id="cfg-isv" type="number" step="0.01" className={input} value={config.porcentajeIsv} onChange={(e) => set('porcentajeIsv', e.target.value)} /></div>
          </div>
        </section>

        <section className="border border-slate-200 rounded-xl p-6">
          <h2 className="font-semibold text-slate-800 mb-4">Respaldo e inventario</h2>
          <div className="space-y-4">
            <div><label className={label}>Correo de respaldo</label>
              <input id="cfg-correo" type="email" className={input} value={config.correoRespaldo ?? ''} onChange={(e) => set('correoRespaldo', e.target.value)} /></div>
            <div><label className={label}>Día de respaldo mensual (1–28)</label>
              <input id="cfg-dia" type="number" min={1} max={28} className={input} value={config.diaRespaldo} onChange={(e) => set('diaRespaldo', Number(e.target.value))} /></div>
            <div><label className={label}>Regla mes sin stock (% de demanda a sustituir)</label>
              <input id="cfg-sinstock" type="number" step="0.01" className={input} value={config.pctMesSinStock} onChange={(e) => set('pctMesSinStock', e.target.value)} /></div>
          </div>
        </section>

        <section className="col-span-2 border border-slate-200 rounded-xl p-6">
          <h2 className="font-semibold text-slate-800 mb-4 flex items-center gap-2"><Landmark className="w-4 h-4 text-amber-500" /> Bancos</h2>
          <table className="w-full text-sm mb-4">
            <thead><tr className="text-left text-xs text-slate-500 border-b border-slate-200">
              <th className="py-2 w-12">#</th><th>Banco</th><th>Cuenta</th><th className="w-12"></th></tr></thead>
            <tbody>
              {bancos.length === 0 && <tr><td colSpan={4} className="py-4 text-center text-slate-400">Sin bancos registrados</td></tr>}
              {bancos.map((b) => (
                <tr key={b.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="py-2 tabular-nums text-slate-400">{b.orden}</td>
                  <td className="font-medium">{b.nombre}</td>
                  <td className="tabular-nums">{b.cuentaEnmascarada}</td>
                  <td><button onClick={() => eliminarBanco(b.id)} className="p-1.5 rounded hover:bg-rose-50 text-slate-400 hover:text-rose-600"><Trash2 className="w-4 h-4" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex gap-3">
            <input id="banco-nombre" className={input} placeholder="Nombre del banco" value={nuevoBanco.nombre}
              onChange={(e) => setNuevoBanco({ ...nuevoBanco, nombre: e.target.value })} />
            <input id="banco-cuenta" className={input} placeholder="Cuenta (ej. ****1234)" value={nuevoBanco.cuentaEnmascarada}
              onChange={(e) => setNuevoBanco({ ...nuevoBanco, cuentaEnmascarada: e.target.value })} />
            <button id="btn-agregar-banco" onClick={agregarBanco}
              className="shrink-0 flex items-center gap-1.5 px-4 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-sm font-semibold transition">
              <Plus className="w-4 h-4" /> Agregar
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

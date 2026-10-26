import { useEffect, useRef, useState } from 'react';
import { Eye, EyeOff, Pencil, Check, X } from 'lucide-react';
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

interface Banco {
  id: number;
  nombre: string;
  cuentaEnmascarada: string;
  orden: number;
}

const DIAS_SEMANA = [
  { val: 1, label: 'Lunes' },
  { val: 2, label: 'Martes' },
  { val: 3, label: 'Miércoles' },
  { val: 4, label: 'Jueves' },
  { val: 5, label: 'Viernes' },
  { val: 6, label: 'Sábado' },
  { val: 7, label: 'Domingo' },
];

export default function Configuracion() {
  const [config, setConfig] = useState<Config | null>(null);
  const configGuardadaRef = useRef<Config | null>(null);
  const [bancos, setBancos] = useState<Banco[]>([]);
  const [agregandoBanco, setAgregandoBanco] = useState(false);
  const [nuevoBanco, setNuevoBanco] = useState({ nombre: '', cuentaEnmascarada: '' });
  const [editandoBancoId, setEditandoBancoId] = useState<number | null>(null);
  const [datosEdicionBanco, setDatosEdicionBanco] = useState({ nombre: '', cuentaEnmascarada: '' });
  
  // Usuario fields
  const [usuario, setUsuario] = useState('');
  const [passwordActual, setPasswordActual] = useState('');
  const [nuevaPassword, setNuevaPassword] = useState('');
  const [repetirPassword, setRepetirPassword] = useState('');
  
  // Ver contraseña toggles
  const [verActual, setVerActual] = useState(false);
  const [verNueva, setVerNueva] = useState(false);
  const [verRepetir, setVerRepetir] = useState(false);
  
  // Feedback
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);
  const [guardandoUsuario, setGuardandoUsuario] = useState(false);

  const cargar = () => {
    api<{ config: Config; bancos: Banco[] }>('/config')
      .then((d) => {
        setConfig(d.config);
        configGuardadaRef.current = d.config;
        setBancos(d.bancos);
      })
      .catch((e) => flash('error', e.message));

    api<{ usuario: string }>('/auth/me')
      .then((d) => {
        setUsuario(d.usuario);
      })
      .catch(() => {});
  };

  useEffect(() => {
    cargar();
  }, []);

  const flash = (tipo: 'ok' | 'error', texto: string) => {
    setMsg({ tipo, texto });
    setTimeout(() => setMsg(null), 3500);
  };

  const guardarConfiguracion = async (nuevoValor?: Partial<Config>) => {
    if (!config) return;
    const datosAGuardar = { ...config, ...(nuevoValor || {}) };
    
    // Comparar con el último valor guardado para evitar peticiones y mensajes si no cambió nada
    const anterior = configGuardadaRef.current;
    if (anterior) {
      const cambio =
        String(datosAGuardar.vendedor).trim() !== String(anterior.vendedor).trim() ||
        String(datosAGuardar.contacto).trim() !== String(anterior.contacto).trim() ||
        String(datosAGuardar.titularCheques ?? '').trim() !== String(anterior.titularCheques ?? '').trim() ||
        Number(datosAGuardar.porcentajeIsv) !== Number(anterior.porcentajeIsv) ||
        String(datosAGuardar.correoRespaldo ?? '').trim() !== String(anterior.correoRespaldo ?? '').trim() ||
        Number(datosAGuardar.diaRespaldo) !== Number(anterior.diaRespaldo);

      if (!cambio) return;
    }

    try {
      await api('/config', {
        method: 'PUT',
        body: JSON.stringify(datosAGuardar),
      });
      configGuardadaRef.current = datosAGuardar;
      flash('ok', 'Configuración guardada');
    } catch (e) {
      flash('error', (e as Error).message);
    }
  };

  const agregarBanco = async () => {
    if (!nuevoBanco.nombre || !nuevoBanco.cuentaEnmascarada) return;
    try {
      await api('/config/bancos', {
        method: 'POST',
        body: JSON.stringify(nuevoBanco),
      });
      setNuevoBanco({ nombre: '', cuentaEnmascarada: '' });
      setAgregandoBanco(false);
      cargar();
      flash('ok', 'Banco agregado');
    } catch (e) {
      flash('error', (e as Error).message);
    }
  };

  const eliminarBanco = async (id: number) => {
    try {
      await api(`/config/bancos/${id}`, { method: 'DELETE' });
      cargar();
      flash('ok', 'Banco eliminado');
    } catch (e) {
      flash('error', (e as Error).message);
    }
  };

  const iniciarEdicionBanco = (b: Banco) => {
    setEditandoBancoId(b.id);
    setDatosEdicionBanco({ nombre: b.nombre, cuentaEnmascarada: b.cuentaEnmascarada });
  };

  const guardarEdicionBanco = async (id: number) => {
    if (!datosEdicionBanco.nombre.trim() || !datosEdicionBanco.cuentaEnmascarada.trim()) {
      flash('error', 'El nombre y la cuenta son requeridos');
      return;
    }
    try {
      await api(`/config/bancos/${id}`, {
        method: 'PUT',
        body: JSON.stringify(datosEdicionBanco),
      });
      setEditandoBancoId(null);
      cargar();
      flash('ok', 'Banco actualizado');
    } catch (e) {
      flash('error', (e as Error).message);
    }
  };

  const guardarUsuario = async () => {
    if (!passwordActual) {
      flash('error', 'Ingresa tu contraseña actual');
      return;
    }
    if (nuevaPassword) {
      if (nuevaPassword.length < 8) {
        flash('error', 'La nueva contraseña debe tener al menos 8 caracteres');
        return;
      }
      if (nuevaPassword !== repetirPassword) {
        flash('error', 'Las contraseñas nuevas no coinciden');
        return;
      }
    }
    setGuardandoUsuario(true);
    try {
      await api<{ usuario: string }>('/auth/password', {
        method: 'PUT',
        body: JSON.stringify({
          usuario,
          passwordActual,
          nueva: nuevaPassword || '',
        }),
      });
      setPasswordActual('');
      setNuevaPassword('');
      setRepetirPassword('');
      flash('ok', 'Usuario y contraseña actualizados');
    } catch (e) {
      flash('error', (e as Error).message);
    } finally {
      setGuardandoUsuario(false);
    }
  };

  if (!config) {
    return <div className="p-8 text-sm text-kolben-muted">Cargando configuración...</div>;
  }

  const inputStyle =
    "w-full rounded-lg border border-kolben-line bg-kolben-field px-3 py-[9px] text-[13px] font-semibold text-kolben-text outline-none transition focus:border-kolben-ink focus:ring-1 focus:ring-kolben-ink";
  const labelStyle =
    "block text-[10px] font-semibold uppercase tracking-[0.08em] text-kolben-muted mb-1";
  const sectionHeader =
    "text-[11px] font-bold uppercase tracking-[0.08em] text-kolben-text mb-4";

  return (
    <div className="space-y-4 pb-12">
      {msg && (
        <div
          role="status"
          className={`p-3 rounded-lg text-xs font-semibold ${
            msg.tipo === 'ok'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          {msg.texto}
        </div>
      )}

      {/* BLOQUE 1: DATOS DE LA PROFORMA */}
      <section className="rounded-xl border border-kolben-line bg-kolben-card p-6 shadow-sm">
        <h2 className={sectionHeader}>
          Datos de la proforma
        </h2>

        <div className="grid grid-cols-3 gap-4 mb-6">
          <div>
            <label htmlFor="cfg-vendedor" className={labelStyle}>Vendedor</label>
            <input
              id="cfg-vendedor"
              className={inputStyle}
              value={config.vendedor}
              onChange={(e) => setConfig({ ...config, vendedor: e.target.value })}
              onBlur={() => guardarConfiguracion()}
            />
          </div>
          <div>
            <label htmlFor="cfg-contacto" className={labelStyle}>Contacto</label>
            <input
              id="cfg-contacto"
              className={inputStyle}
              value={config.contacto}
              onChange={(e) => setConfig({ ...config, contacto: e.target.value })}
              onBlur={() => guardarConfiguracion()}
            />
          </div>
          <div>
            <label htmlFor="cfg-titular" className={labelStyle}>Cheques a nombre de</label>
            <input
              id="cfg-titular"
              className={inputStyle}
              placeholder="[titular de la cuenta]"
              value={config.titularCheques ?? ''}
              onChange={(e) => setConfig({ ...config, titularCheques: e.target.value })}
              onBlur={() => guardarConfiguracion()}
            />
          </div>
        </div>

        {/* BANCOS AUTORIZADOS */}
        <div>
          <div className="text-[11px] font-medium text-kolben-muted mb-3">
            BANCOS AUTORIZADOS
          </div>

          <div className="space-y-2 mb-3 max-w-xl">
            {bancos.map((b) => (
              <div
                key={b.id}
                className="flex items-center justify-between text-sm py-1.5 border-b border-kolben-line/60 group"
              >
                {editandoBancoId === b.id ? (
                  <div className="flex items-center gap-2 w-full py-1">
                    <input
                      className={`${inputStyle} !py-1 !text-xs`}
                      value={datosEdicionBanco.nombre}
                      onChange={(e) => setDatosEdicionBanco({ ...datosEdicionBanco, nombre: e.target.value })}
                      placeholder="Nombre del banco"
                    />
                    <input
                      className={`${inputStyle} !py-1 !text-xs !w-44`}
                      value={datosEdicionBanco.cuentaEnmascarada}
                      onChange={(e) => setDatosEdicionBanco({ ...datosEdicionBanco, cuentaEnmascarada: e.target.value })}
                      placeholder="Cuenta"
                    />
                    <button
                      onClick={() => guardarEdicionBanco(b.id)}
                      className="p-1 rounded text-emerald-600 hover:bg-emerald-50 transition"
                      title="Guardar"
                    >
                      <Check size={16} />
                    </button>
                    <button
                      onClick={() => setEditandoBancoId(null)}
                      className="p-1 rounded text-kolben-muted hover:bg-kolben-bg transition"
                      title="Cancelar"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ) : (
                  <>
                    <span className="font-semibold text-kolben-text text-[13px]">{b.nombre}</span>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-[13px] text-kolben-text tracking-wider">
                        {b.cuentaEnmascarada}
                      </span>
                      <button
                        onClick={() => iniciarEdicionBanco(b)}
                        className="opacity-0 group-hover:opacity-100 text-kolben-muted hover:text-kolben-ink transition p-1"
                        title="Editar"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        onClick={() => eliminarBanco(b.id)}
                        className="opacity-0 group-hover:opacity-100 text-rose-500 hover:text-rose-700 transition p-1"
                        title="Eliminar"
                      >
                        ✕
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>

          {agregandoBanco ? (
            <div className="flex items-center gap-3 max-w-xl mt-3 p-3 bg-white rounded-lg border border-kolben-line">
              <input
                className={inputStyle}
                placeholder="Nombre del banco (ej. BAC ahorros)"
                value={nuevoBanco.nombre}
                onChange={(e) => setNuevoBanco({ ...nuevoBanco, nombre: e.target.value })}
              />
              <input
                className={inputStyle}
                placeholder="Cuenta (ej. ••••6381)"
                value={nuevoBanco.cuentaEnmascarada}
                onChange={(e) => setNuevoBanco({ ...nuevoBanco, cuentaEnmascarada: e.target.value })}
              />
              <button
                onClick={agregarBanco}
                className="px-3 py-2 bg-kolben-ink hover:bg-kolben-ink-dark text-white text-xs font-bold rounded-lg shrink-0"
              >
                Guardar
              </button>
              <button
                onClick={() => setAgregandoBanco(false)}
                className="px-2 py-2 text-kolben-muted hover:text-kolben-text text-xs shrink-0"
              >
                Cancelar
              </button>
            </div>
          ) : (
            <button
              onClick={() => setAgregandoBanco(true)}
              className="text-[12px] font-semibold text-kolben-muted hover:text-kolben-ink hover:underline"
            >
              + agregar banco
            </button>
          )}
        </div>
      </section>

      {/* BLOQUE 2: IMPUESTO */}
      <section className="rounded-xl border border-kolben-line bg-kolben-card p-6 shadow-sm">
        <h2 className={sectionHeader}>Impuesto</h2>
        <div className="max-w-[120px]">
          <label htmlFor="cfg-isv" className={labelStyle}>ISV</label>
          <div className="relative">
            <input
              id="cfg-isv"
              type="number"
              step="0.01"
              className={inputStyle}
              value={config.porcentajeIsv}
              onChange={(e) => setConfig({ ...config, porcentajeIsv: e.target.value })}
              onBlur={() => guardarConfiguracion()}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-kolben-muted">
              %
            </span>
          </div>
        </div>
      </section>

      {/* BLOQUE 3: RESPALDO SEMANAL DE POR COBRAR */}
      <section className="rounded-xl border border-kolben-line bg-kolben-card p-6 shadow-sm">
        <h2 className={sectionHeader}>Respaldo semanal de por cobrar</h2>
        <div className="flex items-end gap-4 max-w-2xl">
          <div className="flex-1">
            <label htmlFor="cfg-correo" className={labelStyle}>Correo</label>
            <input
              id="cfg-correo"
              type="email"
              className={inputStyle}
              placeholder="javierescalante77@gmail.com"
              value={config.correoRespaldo ?? ''}
              onChange={(e) => setConfig({ ...config, correoRespaldo: e.target.value })}
              onBlur={() => guardarConfiguracion()}
            />
          </div>
          <div className="w-36">
            <label htmlFor="cfg-dia" className={labelStyle}>Día</label>
            <select
              id="cfg-dia"
              className={inputStyle}
              value={config.diaRespaldo}
              onChange={(e) => {
                const val = Number(e.target.value);
                setConfig({ ...config, diaRespaldo: val });
                guardarConfiguracion({ diaRespaldo: val });
              }}
            >
              {DIAS_SEMANA.map((d) => (
                <option key={d.val} value={d.val}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={() => flash('ok', 'Prueba de respaldo enviada')}
            className="px-4 py-[9px] rounded-lg border border-kolben-line bg-white hover:bg-slate-50 text-[11px] font-bold uppercase tracking-[0.08em] text-kolben-text transition shrink-0"
          >
            Enviar prueba
          </button>
        </div>
      </section>

      {/* BLOQUE 4: USUARIO */}
      <section className="rounded-xl border border-kolben-line bg-kolben-card p-6 shadow-sm">
        <h2 className={sectionHeader}>Usuario</h2>
        <div className="grid grid-cols-4 gap-4 mb-4">
          <div>
            <label htmlFor="usr-nombre" className={labelStyle}>Usuario</label>
            <input
              id="usr-nombre"
              className={inputStyle}
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="usr-pwd-actual" className={labelStyle}>Contraseña actual</label>
            <div className="relative">
              <input
                id="usr-pwd-actual"
                type={verActual ? 'text' : 'password'}
                className={`${inputStyle} pr-9`}
                placeholder="••••••••"
                value={passwordActual}
                onChange={(e) => setPasswordActual(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setVerActual(!verActual)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-kolben-muted hover:text-kolben-text transition p-0.5"
                title={verActual ? "Ocultar" : "Mostrar"}
              >
                {verActual ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
          <div>
            <label htmlFor="usr-pwd-nueva" className={labelStyle}>Nueva</label>
            <div className="relative">
              <input
                id="usr-pwd-nueva"
                type={verNueva ? 'text' : 'password'}
                className={`${inputStyle} pr-9`}
                placeholder="••••••••"
                value={nuevaPassword}
                onChange={(e) => setNuevaPassword(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setVerNueva(!verNueva)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-kolben-muted hover:text-kolben-text transition p-0.5"
                title={verNueva ? "Ocultar" : "Mostrar"}
              >
                {verNueva ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
          <div>
            <label htmlFor="usr-pwd-repetir" className={labelStyle}>Repetir nueva</label>
            <div className="relative">
              <input
                id="usr-pwd-repetir"
                type={verRepetir ? 'text' : 'password'}
                className={`${inputStyle} pr-9`}
                placeholder="••••••••"
                value={repetirPassword}
                onChange={(e) => setRepetirPassword(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setVerRepetir(!verRepetir)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-kolben-muted hover:text-kolben-text transition p-0.5"
                title={verRepetir ? "Ocultar" : "Mostrar"}
              >
                {verRepetir ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-1">
          <button
            onClick={guardarUsuario}
            disabled={guardandoUsuario}
            className="px-4 py-[9px] rounded-lg bg-kolben-ink hover:bg-kolben-ink-dark text-white text-[11px] font-bold uppercase tracking-[0.08em] transition disabled:opacity-50"
          >
            {guardandoUsuario ? 'Guardando...' : 'Cambiar contraseña'}
          </button>
        </div>
      </section>
    </div>
  );
}

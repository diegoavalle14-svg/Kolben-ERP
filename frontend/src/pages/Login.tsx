import { useEffect, useState, type FormEvent } from 'react';
import { Lock, User, LogIn, Sparkles } from 'lucide-react';
import { api } from '../lib/api';

interface Props {
  onLogin: (usuario: string) => void;
}

export default function Login({ onLogin }: Props) {
  const [requiereSetup, setRequiereSetup] = useState<boolean | null>(null);
  const [usuario, setUsuario] = useState('');
  const [password, setPassword] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    api<{ requiereSetup: boolean }>('/auth/estado')
      .then((d) => setRequiereSetup(d.requiereSetup))
      .catch((e) => setError(`No se pudo conectar con el servidor: ${e.message}`));
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (requiereSetup && password !== confirmar) {
      setError('Las contraseñas no coinciden');
      return;
    }
    setCargando(true);
    try {
      const d = await api<{ usuario: string }>(requiereSetup ? '/auth/setup' : '/auth/login', {
        method: 'POST',
        body: JSON.stringify({ usuario, password }),
      });
      onLogin(d.usuario);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setCargando(false);
    }
  };

  const input =
    'w-full pl-10 pr-3 py-2.5 rounded-lg bg-slate-950/60 border border-slate-700 text-slate-100 text-sm placeholder:text-slate-500 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition';

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center relative overflow-hidden">
      <div className="absolute -top-40 -left-40 w-[500px] h-[500px] bg-amber-500/10 rounded-full blur-3xl" />
      <div className="absolute -bottom-40 -right-40 w-[500px] h-[500px] bg-sky-500/10 rounded-full blur-3xl" />

      <form
        onSubmit={submit}
        className="relative w-[400px] bg-slate-900/80 backdrop-blur border border-slate-800 rounded-2xl p-8 shadow-2xl"
      >
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-300 flex items-center justify-center font-black text-2xl text-slate-950 shadow-lg shadow-amber-500/30 mb-4">
            K
          </div>
          <h1 className="text-xl font-bold text-white tracking-wide">KOLBEN ERP</h1>
          <p className="text-xs text-slate-400 mt-1">
            {requiereSetup ? 'Primer uso: crea tu usuario administrador' : 'Ingresa para continuar'}
          </p>
        </div>

        {requiereSetup && (
          <div className="mb-5 flex items-start gap-2 text-xs text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
            <Sparkles className="w-4 h-4 shrink-0 mt-0.5" />
            No hay usuarios registrados. El usuario que crees tendrá control total del sistema.
          </div>
        )}

        <div className="space-y-4">
          <div className="relative">
            <User className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input id="login-usuario" className={input} placeholder="Usuario" value={usuario}
              onChange={(e) => setUsuario(e.target.value)} autoComplete="username" required />
          </div>
          <div className="relative">
            <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input id="login-password" type="password" className={input} placeholder="Contraseña" value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={requiereSetup ? 'new-password' : 'current-password'} required />
          </div>
          {requiereSetup && (
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input id="login-confirmar" type="password" className={input} placeholder="Confirmar contraseña"
                value={confirmar} onChange={(e) => setConfirmar(e.target.value)} autoComplete="new-password" required />
            </div>
          )}
        </div>

        {error && (
          <div className="mt-4 text-xs text-rose-300 bg-rose-500/10 border border-rose-500/20 rounded-lg p-3">{error}</div>
        )}

        <button id="login-submit" type="submit" disabled={cargando || requiereSetup === null}
          className="mt-6 w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-semibold text-sm transition shadow-lg shadow-amber-500/20">
          <LogIn className="w-4 h-4" />
          {cargando ? 'Procesando...' : requiereSetup ? 'Crear usuario e ingresar' : 'Ingresar'}
        </button>
      </form>
    </div>
  );
}

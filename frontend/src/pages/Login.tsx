import { useEffect, useState, type FormEvent } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { api } from '../lib/api';
import Logo from '../components/Logo';

interface Props {
  onLogin: (usuario: string) => void;
}

const etiqueta = 'mb-[5px] block text-[10px] font-medium uppercase tracking-[0.08em] text-kolben-muted';
const campo =
  'w-full rounded-lg border border-kolben-line bg-kolben-field px-3 py-[10px] text-[13px] font-semibold text-kolben-text outline-none transition focus:border-kolben-ink focus:ring-2 focus:ring-kolben-ink/15';

export default function Login({ onLogin }: Props) {
  const [requiereSetup, setRequiereSetup] = useState<boolean | null>(null);
  const [usuario, setUsuario] = useState('');
  const [password, setPassword] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [verPassword, setVerPassword] = useState(false);
  const [verConfirmar, setVerConfirmar] = useState(false);
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

  return (
    <div className="flex min-h-screen items-center justify-center bg-kolben-bg">
      <form
        onSubmit={submit}
        className="w-[300px] rounded-[14px] border border-kolben-line bg-white px-6 pb-6 pt-7 shadow-[0_2px_14px_rgba(35,74,94,0.08)]"
      >
        <div className="mb-6 flex justify-center">
          <Logo />
        </div>

        {requiereSetup && (
          <p className="mb-4 rounded-lg border border-kolben-orange/40 bg-kolben-orange/10 p-[10px] text-[11px] leading-snug text-kolben-text">
            <strong>Primer uso.</strong> Crea el usuario que tendrá control total del sistema (mínimo 8 caracteres en la contraseña).
          </p>
        )}

        <div className="space-y-3">
          <div>
            <label htmlFor="login-usuario" className={etiqueta}>Usuario</label>
            <input id="login-usuario" className={campo} value={usuario} autoComplete="username"
              onChange={(e) => setUsuario(e.target.value)} required />
          </div>
          <div>
            <label htmlFor="login-password" className={etiqueta}>Contraseña</label>
            <div className="relative">
              <input id="login-password" type={verPassword ? 'text' : 'password'} className={`${campo} pr-9`} value={password}
                autoComplete={requiereSetup ? 'new-password' : 'current-password'}
                onChange={(e) => setPassword(e.target.value)} required />
              <button
                type="button"
                onClick={() => setVerPassword(!verPassword)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-kolben-muted hover:text-kolben-text transition p-0.5"
                title={verPassword ? "Ocultar" : "Mostrar"}
              >
                {verPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
          {requiereSetup && (
            <div>
              <label htmlFor="login-confirmar" className={etiqueta}>Repetir contraseña</label>
              <div className="relative">
                <input id="login-confirmar" type={verConfirmar ? 'text' : 'password'} className={`${campo} pr-9`} value={confirmar}
                  autoComplete="new-password" onChange={(e) => setConfirmar(e.target.value)} required />
                <button
                  type="button"
                  onClick={() => setVerConfirmar(!verConfirmar)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-kolben-muted hover:text-kolben-text transition p-0.5"
                  title={verConfirmar ? "Ocultar" : "Mostrar"}
                >
                  {verConfirmar ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          )}
        </div>

        {error && (
          <p role="alert" className="mt-3 rounded-lg border border-kolben-red/30 bg-kolben-red/10 p-[10px] text-[11px] text-kolben-red">
            {error}
          </p>
        )}

        <button
          id="login-submit"
          type="submit"
          disabled={cargando || requiereSetup === null}
          className="mt-5 w-full rounded-lg border-0 bg-kolben-ink py-[11px] text-[11px] font-bold uppercase tracking-[0.12em] text-white transition hover:bg-kolben-ink-dark disabled:opacity-50"
        >
          {cargando ? 'Procesando…' : requiereSetup ? 'Crear usuario y entrar' : 'Entrar'}
        </button>
      </form>
    </div>
  );
}

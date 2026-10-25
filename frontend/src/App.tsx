import { useEffect, useState } from 'react';
import { 
  CheckCircle2, 
  Server, 
  Database, 
  Layers, 
  ShieldCheck, 
  Activity, 
  ExternalLink,
  RefreshCw 
} from 'lucide-react';

interface HealthData {
  status: string;
  app: string;
  env: string;
  timestamp: string;
}

export function App() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHealth = () => {
    setLoading(true);
    setError(null);
    fetch('/api/health')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP error ${res.status}`);
        return res.json();
      })
      .then((data: HealthData) => {
        setHealth(data);
        setLoading(false);
      })
      .catch((err: Error) => {
        setError(err.message);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchHealth();
  }, []);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col justify-between">
      {/* Top Header */}
      <header className="border-b border-slate-800 bg-slate-950/60 backdrop-blur sticky top-0 z-50">
        <div className="w-[1280px] max-w-full mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-amber-500 to-amber-300 flex items-center justify-center font-bold text-slate-950 shadow-lg shadow-amber-500/20">
              K
            </div>
            <div>
              <span className="font-extrabold tracking-wider text-lg text-white">KOLBEN</span>
              <span className="text-xs ml-1.5 px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 font-medium border border-amber-500/20">
                ERP v1.0
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <span className="flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700/60">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Etapa 0: Cimientos
            </span>
            <div className="text-xs text-slate-400 border-l border-slate-800 pl-4">
              Ancho base fijado: <strong className="text-slate-200">1280px</strong>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container - Ancho estricto 1280px centrado según especificación */}
      <main className="w-[1280px] max-w-full mx-auto px-6 py-10 flex-1 flex flex-col gap-8">
        {/* Banner Hero */}
        <section className="bg-gradient-to-br from-slate-800/80 via-slate-800/40 to-slate-900 border border-slate-700/60 rounded-2xl p-8 shadow-xl relative overflow-hidden">
          <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl pointer-events-none"></div>
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-amber-400/10 text-amber-400 text-xs font-semibold mb-4 border border-amber-400/20">
              <Activity className="w-3.5 h-3.5" />
              Sistema Administrativo Interno
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-white mb-3">
              Kolben Repuestos Automotrices
            </h1>
            <p className="text-slate-400 text-sm leading-relaxed mb-6">
              Plataforma integral a medida para gestión de cilindros de freno y clutch, ventas POS,
              cuentas por cobrar, inventario FIFO multicosto, calculadora de cobertura y flujo de caja proyectado.
            </p>
            <div className="flex items-center gap-3">
              <button 
                onClick={fetchHealth}
                className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold rounded-lg text-sm transition-colors shadow-md shadow-amber-500/20"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                Comprobar Conexión Backend
              </button>
              <a 
                href="/docs/PLAN_ETAPAS.md" 
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium rounded-lg text-sm transition-colors border border-slate-700"
              >
                Ver Plan de Etapas <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </section>

        {/* Status Grid */}
        <section className="grid grid-cols-3 gap-6">
          {/* Card Backend Health */}
          <div className="bg-slate-800/50 border border-slate-700/60 rounded-xl p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                  <Server className="w-4 h-4 text-sky-400" />
                  API Backend
                </span>
                {health?.status === 'ok' ? (
                  <span className="px-2 py-0.5 rounded text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Online
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                    {loading ? 'Consultando...' : 'Desconectado'}
                  </span>
                )}
              </div>
              <h3 className="text-base font-semibold text-white mb-1">Servicio Node + Express</h3>
              <p className="text-xs text-slate-400 mb-4">
                Endpoint <code>/api/health</code> responde con cabeceras Helmet y cookies protegidas.
              </p>
            </div>
            <div className="bg-slate-950/50 rounded-lg p-3 text-xs font-mono text-slate-300 border border-slate-800">
              {loading ? (
                <div className="text-slate-500">Comprobando endpoint...</div>
              ) : error ? (
                <div className="text-rose-400">Error: {error} (Verifica que el backend esté arriba en puerto 4000)</div>
              ) : (
                <>
                  <div><span className="text-slate-500">App:</span> {health?.app}</div>
                  <div><span className="text-slate-500">Entorno:</span> {health?.env}</div>
                  <div><span className="text-slate-500">Hora:</span> {health?.timestamp ? new Date(health.timestamp).toLocaleTimeString() : '-'}</div>
                </>
              )}
            </div>
          </div>

          {/* Card Base de Datos & Prisma */}
          <div className="bg-slate-800/50 border border-slate-700/60 rounded-xl p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                  <Database className="w-4 h-4 text-emerald-400" />
                  Base de Datos
                </span>
                <span className="px-2 py-0.5 rounded text-xs font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/20">
                  Prisma ORM
                </span>
              </div>
              <h3 className="text-base font-semibold text-white mb-1">PostgreSQL + Schema</h3>
              <p className="text-xs text-slate-400 mb-4">
                25 modelos relacionales definidos: Usuarios, Códigos, Lotes FIFO, Proformas, Facturas y Flujo.
              </p>
            </div>
            <div className="space-y-1.5 text-xs text-slate-300">
              <div className="flex items-center justify-between py-1 border-b border-slate-800">
                <span className="text-slate-400">Driver</span>
                <span className="font-mono text-white">PostgreSQL</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-slate-800">
                <span className="text-slate-400">Esquema</span>
                <span className="font-mono text-white">schema.prisma</span>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-slate-400">Precisión Moneda</span>
                <span className="font-mono text-emerald-400 font-semibold">NUMERIC(12,2)</span>
              </div>
            </div>
          </div>

          {/* Card Próxima Etapa */}
          <div className="bg-slate-800/50 border border-amber-500/30 rounded-xl p-6 flex flex-col justify-between relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/10 rounded-bl-full pointer-events-none"></div>
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-2">
                  <Layers className="w-4 h-4" />
                  Siguiente Fase
                </span>
                <span className="px-2 py-0.5 rounded text-xs font-semibold bg-amber-500/20 text-amber-300">
                  Etapa 1
                </span>
              </div>
              <h3 className="text-base font-semibold text-white mb-1">Login & Configuración</h3>
              <p className="text-xs text-slate-400 mb-4">
                Autenticación JWT en cookie HttpOnly, panel de login, layout lateral con navegación e inicialización de usuario.
              </p>
            </div>
            <div className="bg-slate-950/40 rounded-lg p-3 text-xs text-slate-300 border border-slate-800/80">
              <div className="flex items-center gap-2 text-slate-300 mb-1">
                <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Cookies HttpOnly + SameSite</span>
              </div>
              <div className="text-[11px] text-slate-400">
                Menú lateral fijo de 1280px con acceso a los 13 módulos del sistema.
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 py-4 text-center text-xs text-slate-500 bg-slate-950/40">
        Kolben ERP &copy; 2026 — Distribuidora de Repuestos Automotrices. Todos los derechos reservados.
      </footer>
    </div>
  );
}

export default App;

import type { ReactNode } from 'react';
import {
  LayoutDashboard, ShoppingCart, BarChart3, TrendingUp, Calculator, Truck, Users,
  Receipt, Package, FileText, Wallet, BookOpen, Settings, LogOut,
} from 'lucide-react';

export type ModuloId =
  | 'resumen' | 'pos' | 'ventas-codigo' | 'utilidad-codigo' | 'calculadora' | 'pedidos'
  | 'clientes' | 'por-cobrar' | 'productos' | 'ficha' | 'caja' | 'catalogo' | 'config';

export const MODULOS: { id: ModuloId; nombre: string; icon: typeof Settings; etapa: number }[] = [
  { id: 'resumen', nombre: 'Resumen', icon: LayoutDashboard, etapa: 12 },
  { id: 'pos', nombre: 'POS · Nueva venta', icon: ShoppingCart, etapa: 5 },
  { id: 'ventas-codigo', nombre: 'Ventas por código', icon: BarChart3, etapa: 7 },
  { id: 'utilidad-codigo', nombre: 'Utilidad por código', icon: TrendingUp, etapa: 8 },
  { id: 'calculadora', nombre: 'Calculadora', icon: Calculator, etapa: 10 },
  { id: 'pedidos', nombre: 'Pedidos', icon: Truck, etapa: 9 },
  { id: 'clientes', nombre: 'Clientes', icon: Users, etapa: 4 },
  { id: 'por-cobrar', nombre: 'Ventas · Por cobrar', icon: Receipt, etapa: 6 },
  { id: 'productos', nombre: 'Productos', icon: Package, etapa: 2 },
  { id: 'ficha', nombre: 'Ficha de código', icon: FileText, etapa: 3 },
  { id: 'caja', nombre: 'Caja y flujo', icon: Wallet, etapa: 11 },
  { id: 'catalogo', nombre: 'Catálogo', icon: BookOpen, etapa: 13 },
  { id: 'config', nombre: 'Configuración', icon: Settings, etapa: 1 },
];

interface Props {
  usuario: string;
  activo: ModuloId;
  onNavegar: (id: ModuloId) => void;
  onLogout: () => void;
  children: ReactNode;
}

export default function Layout({ usuario, activo, onNavegar, onLogout, children }: Props) {
  return (
    <div className="min-h-screen bg-slate-100 flex justify-center">
      <div className="w-[1280px] min-h-screen flex bg-white shadow-xl">
        <aside className="w-60 shrink-0 bg-slate-950 text-slate-300 flex flex-col sticky top-0 h-screen">
          <div className="h-16 px-5 flex items-center gap-3 border-b border-slate-800">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-amber-500 to-amber-300 flex items-center justify-center font-black text-slate-950">K</div>
            <span className="font-extrabold tracking-wider text-white">KOLBEN</span>
          </div>
          <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
            {MODULOS.map(({ id, nombre, icon: Icon }) => {
              const sel = id === activo;
              return (
                <button key={id} id={`nav-${id}`} onClick={() => onNavegar(id)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition ${
                    sel ? 'bg-amber-500/15 text-amber-300 font-semibold' : 'hover:bg-slate-800/70 hover:text-white'
                  }`}>
                  <Icon className={`w-4 h-4 ${sel ? 'text-amber-400' : 'text-slate-500'}`} />
                  {nombre}
                </button>
              );
            })}
          </nav>
          <div className="border-t border-slate-800 p-3 flex items-center justify-between">
            <div className="text-xs">
              <div className="text-slate-500">Sesión</div>
              <div className="text-white font-medium">{usuario}</div>
            </div>
            <button id="btn-logout" onClick={onLogout} title="Cerrar sesión"
              className="p-2 rounded-lg hover:bg-rose-500/15 hover:text-rose-300 transition">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </aside>
        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  );
}

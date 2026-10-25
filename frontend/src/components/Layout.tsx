import type { ReactNode } from 'react';
import Logo from './Logo';

export type ModuloId =
  | 'resumen' | 'pos' | 'ventas' | 'clientes' | 'productos'
  | 'calculadora' | 'pedidos' | 'ventas-codigo' | 'utilidad-codigo'
  | 'caja' | 'catalogo' | 'config';

interface ItemMenu {
  id: ModuloId;
  nombre: string;
  titulo: string; // encabezado de la pantalla
  etapa: number;
  sub?: boolean; // sub-ítem indentado (grupo Compras)
}

/** Menú exacto del mockup A.14 (orden y agrupación). */
export const MENU: (ItemMenu | { grupo: string })[] = [
  { id: 'resumen', nombre: 'Resumen', titulo: 'Inicio · Resumen del sistema', etapa: 12 },
  { id: 'pos', nombre: 'POS', titulo: 'POS · Nueva venta', etapa: 5 },
  { id: 'ventas', nombre: 'Ventas', titulo: 'Ventas · Por cobrar', etapa: 6 },
  { id: 'clientes', nombre: 'Clientes', titulo: 'Clientes', etapa: 4 },
  { id: 'productos', nombre: 'Productos', titulo: 'Productos y listas', etapa: 2 },
  { grupo: 'Compras' },
  { id: 'calculadora', nombre: 'Calculadora', titulo: 'Compras · Calculadora', etapa: 10, sub: true },
  { id: 'pedidos', nombre: 'Pedidos', titulo: 'Compras · Pedidos', etapa: 9, sub: true },
  { id: 'ventas-codigo', nombre: 'Ventas por código', titulo: 'Ventas por código', etapa: 7 },
  { id: 'utilidad-codigo', nombre: 'Utilidad por código', titulo: 'Utilidad por código', etapa: 8 },
  { id: 'caja', nombre: 'Caja', titulo: 'Caja', etapa: 11 },
  { id: 'catalogo', nombre: 'Catálogo', titulo: 'Catálogo', etapa: 13 },
  { id: 'config', nombre: 'Configuración', titulo: 'Menú y configuración', etapa: 1 },
];

export const MODULOS = MENU.filter((m): m is ItemMenu => 'id' in m);

interface Props {
  usuario: string;
  activo: ModuloId;
  onNavegar: (id: ModuloId) => void;
  onLogout: () => void;
  children: ReactNode;
}

export default function Layout({ usuario, activo, onNavegar, onLogout, children }: Props) {
  const actual = MODULOS.find((m) => m.id === activo);

  return (
    <div className="mx-auto min-h-screen w-[1280px] px-10 pb-10 pt-8">
      {/* Encabezado: logo + título de la pantalla */}
      <header className="flex items-center gap-5 border-b border-kolben-line pb-5">
        <Logo />
        <h1 className="m-0 text-[22px] font-extrabold uppercase tracking-[0.01em] text-kolben-text">
          {actual?.titulo}
        </h1>
      </header>

      <div className="mt-6 flex items-start gap-5">
        {/* Menú lateral */}
        <aside className="sticky top-6 w-[210px] shrink-0 rounded-[18px] bg-kolben-ink pb-5 pt-6 text-white shadow-sm">
          <div className="px-[22px] pb-4 text-[17px] font-extrabold tracking-[0.22em]">KOLBEN</div>

          <nav className="flex flex-col gap-[2px]" aria-label="Menú principal">
            {MENU.map((item) => {
              if ('grupo' in item) {
                return (
                  <div key={item.grupo} className="mx-[10px] px-3 py-2 text-[14px] font-semibold text-white">
                    {item.grupo}
                  </div>
                );
              }
              const sel = item.id === activo;
              return (
                <button
                  key={item.id}
                  id={`nav-${item.id}`}
                  onClick={() => onNavegar(item.id)}
                  className={[
                    'mx-[10px] rounded-[10px] border-0 py-2 text-left transition-colors',
                    item.sub ? 'pl-6 pr-3 text-[13px] font-normal' : 'px-3 text-[14px] font-semibold',
                    sel
                      ? 'bg-kolben-teal text-white'
                      : item.sub
                        ? 'bg-transparent text-kolben-ink-soft hover:bg-white/10 hover:text-white'
                        : 'bg-transparent text-white hover:bg-white/10',
                  ].join(' ')}
                >
                  {item.nombre}
                </button>
              );
            })}
          </nav>

          <div className="mx-[22px] mt-4 border-t border-white/15 pt-4 text-[13px]">
            <span className="text-kolben-ink-soft">{usuario} · </span>
            <button
              id="btn-logout"
              onClick={onLogout}
              className="border-0 bg-transparent p-0 text-[13px] font-bold text-white hover:underline"
            >
              Salir
            </button>
          </div>
        </aside>

        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}

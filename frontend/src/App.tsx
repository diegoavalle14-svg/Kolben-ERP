import { useEffect, useState } from 'react';
import { Construction } from 'lucide-react';
import { api } from './lib/api';
import Login from './pages/Login';
import Layout, { MODULOS, type ModuloId } from './components/Layout';
import Configuracion from './pages/Configuracion';
import Productos from './pages/Productos';

function Pendiente({ id }: { id: ModuloId }) {
  const m = MODULOS.find((x) => x.id === id)!;
  return (
    <div className="h-full flex flex-col items-center justify-center text-center p-10">
      <Construction className="w-10 h-10 text-amber-500 mb-3" />
      <h1 className="text-xl font-bold text-slate-800">{m.nombre}</h1>
      <p className="text-sm text-slate-500 mt-1">Este módulo se construye en la Etapa {m.etapa}.</p>
    </div>
  );
}

export default function App() {
  const [usuario, setUsuario] = useState<string | null>(null);
  const [verificando, setVerificando] = useState(true);
  const [modulo, setModulo] = useState<ModuloId>('config');

  useEffect(() => {
    api<{ usuario: string }>('/auth/me')
      .then((d) => setUsuario(d.usuario))
      .catch(() => setUsuario(null))
      .finally(() => setVerificando(false));
  }, []);

  const logout = async () => {
    await api('/auth/logout', { method: 'POST' }).catch(() => {});
    setUsuario(null);
  };

  if (verificando) {
    return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400 text-sm">Cargando...</div>;
  }

  if (!usuario) return <Login onLogin={setUsuario} />;

  return (
    <Layout usuario={usuario} activo={modulo} onNavegar={setModulo} onLogout={logout}>
      {modulo === 'config' ? <Configuracion /> : modulo === 'productos' ? <Productos /> : <Pendiente id={modulo} />}
    </Layout>
  );
}

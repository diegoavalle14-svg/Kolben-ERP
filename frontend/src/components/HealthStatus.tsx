import React, { useEffect, useState } from 'react';

interface HealthData {
  status: string;
  app: string;
  env: string;
  timestamp: string;
}

const HealthStatus: React.FC = () => {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Backend URL can be overridden via VITE_BACKEND_URL env var
    const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';
    fetch(`${backendUrl}/api/health`)
      .then((res) => {
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        return res.json();
      })
      .then((data) => setHealth(data))
      .catch((err) => setError(err.message));
  }, []);

  if (error) {
    return <div className="text-red-500">Error: {error}</div>;
  }

  if (!health) {
    return <div className="text-gray-400">Cargando estado del servidor...</div>;
  }

  return (
    <div className="p-4 bg-white/30 backdrop-blur-sm rounded-lg shadow-md">
      <h2 className="text-xl font-semibold mb-2">💡 Estado del Backend</h2>
      <pre className="whitespace-pre-wrap text-sm">{JSON.stringify(health, null, 2)}</pre>
    </div>
  );
};

export default HealthStatus;

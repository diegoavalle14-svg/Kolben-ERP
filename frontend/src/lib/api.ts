export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    let msg = data.error || `Error ${res.status}`;
    if (data.detalles?.fieldErrors) {
      const errores = Object.entries(data.detalles.fieldErrors)
        .map(([campo, errs]) => `${campo}: ${(errs as string[]).join(', ')}`)
        .join('; ');
      if (errores) msg += ` (${errores})`;
    }
    throw new ApiError(res.status, msg);
  }
  return data as T;
}

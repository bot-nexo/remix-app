const AUTORESPONDER_URL = import.meta.env.DEV
  ? '/autoresponder-api'
  : import.meta.env.VITE_AUTORESPONDER_URL || '';

export async function bookingRequest<T>(path: string, token: string, options: RequestInit = {}): Promise<T> {
  if (!token) throw new Error('El enlace de reservas no es válido o expiró.');
  if (!AUTORESPONDER_URL) throw new Error('El servicio de reservas no está configurado.');

  const headers = new Headers(options.headers);
  headers.set('Authorization', `Bearer ${token}`);
  if (options.body) headers.set('Content-Type', 'application/json');

  const response = await fetch(`${AUTORESPONDER_URL.replace(/\/$/, '')}/api/booking${path}`, {
    ...options,
    headers,
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || 'No se pudo completar la operación.');
  return result as T;
}

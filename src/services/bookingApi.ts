const AUTORESPONDER_URL = import.meta.env.DEV
  ? '/autoresponder-api'
  : import.meta.env.VITE_AUTORESPONDER_URL || '';

export class BookingRequestError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = 'BookingRequestError';
  }
}

export function getBookingErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof BookingRequestError) {
    if (error.status === 401) return 'El enlace de reserva ya no es válido. Solicita uno nuevo por WhatsApp.';
    if (error.status === 409) return error.message || 'La cita cambió. Actualiza los horarios e inténtalo de nuevo.';
    if (error.status >= 500) return 'El servicio de reservas no está disponible ahora. Inténtalo de nuevo en unos minutos.';
    return error.message || fallback;
  }
  return error instanceof Error && error.message ? error.message : fallback;
}

export async function bookingRequest<T>(path: string, token: string, options: RequestInit = {}): Promise<T> {
  if (!token) throw new Error('El enlace de reservas no es válido o expiró.');
  if (!AUTORESPONDER_URL) throw new Error('El servicio de reservas no está configurado.');

  const headers = new Headers(options.headers);
  headers.set('Authorization', `Bearer ${token}`);
  headers.set('ngrok-skip-browser-warning', '1');
  if (options.body) headers.set('Content-Type', 'application/json');

  const response = await fetch(`${AUTORESPONDER_URL.replace(/\/$/, '')}/api/booking${path}`, {
    ...options,
    headers,
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new BookingRequestError(response.status, result.error || 'No se pudo completar la operación.');
  return result as T;
}

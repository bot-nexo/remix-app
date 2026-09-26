import { bookingRequest } from './bookingApi';

export async function verificarDisponibilidadFecha(
  fechaStr: string,
  servicioId: string,
  token: string
): Promise<boolean> {
  const slots = await obtenerHorariosDisponibles(fechaStr, servicioId, token);
  return slots.length > 0;
}

export async function obtenerHorariosDisponibles(
  fechaStr: string,
  servicioId: string,
  token: string,
  citaIdExcluir?: string
): Promise<string[]> {
  const params = new URLSearchParams({ date: fechaStr, serviceId: servicioId });
  if (citaIdExcluir) params.set('excludeAppointmentId', citaIdExcluir);
  const { slots } = await bookingRequest<{ slots: string[] }>(`/availability?${params}`, token);
  return slots;
}

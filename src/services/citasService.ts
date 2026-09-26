import { bookingRequest } from './bookingApi';

type CrearCitaPayload = {
  servicioId: string;
  nombreCliente: string;
  telefonoCliente: string;
  fechaInicio: string;
  horaInicio: string;
};

export async function crearCita(payload: CrearCitaPayload, token: string) {
  const { appointment } = await bookingRequest<{ appointment: unknown }>('/appointments', token, {
    method: 'POST',
    body: JSON.stringify({
      serviceId: payload.servicioId,
      name: payload.nombreCliente,
      phone: payload.telefonoCliente,
      date: payload.fechaInicio,
      startTime: payload.horaInicio,
    }),
  });
  return appointment;
}

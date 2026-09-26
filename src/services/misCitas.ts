import { bookingRequest } from './bookingApi';

export type Citas = {
    id: string;
    user_id: string;
    servicio_id: string;
    cliente_id: string;
    cliente_nombre: string;
    cliente_numero: string;
    fecha_inicio: string;
    hora_inicio: string;
    hora_fin: string;
    duracion_servicio: number;
    estado: string;
    servicios: { id: string; nombre: string; valor: number; duracion_minutos: number } | null;
};

export async function obtenerMisCitas(token: string): Promise<Citas[]> {
    const { appointments } = await bookingRequest<{ appointments: Citas[] }>('/appointments', token);
    return appointments;
};

export async function obtenerActivas(token: string): Promise<Citas[]> {
    const { appointments } = await bookingRequest<{ appointments: Citas[] }>('/appointments?active=true', token);
    return appointments;
}

export async function cancelarCita(idCita: string, token: string): Promise<boolean> {
    await bookingRequest(`/appointments/${encodeURIComponent(idCita)}/cancel`, token, { method: 'POST' });
    return true;
};

export async function reagendarCita(
    idCita: string,
    nuevaFecha: string,
    nuevaHoraInicio: string,
    token: string
): Promise<boolean> {
    await bookingRequest(`/appointments/${encodeURIComponent(idCita)}/reschedule`, token, {
        method: 'POST',
        body: JSON.stringify({ date: nuevaFecha, startTime: nuevaHoraInicio }),
    });
    return true;
}



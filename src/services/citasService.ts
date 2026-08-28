import { supabase } from '../lib/supabase';

const USER_ID = import.meta.env.VITE_NEGOCIO_USER_ID;

type CrearCitaPayload = {
    servicioId: string | null;
    clienteId: string | null;
    nombreCliente: string | null;
    telefonoCliente: string | null;
    fechaInicio: string | null; // YYYY-MM-DD
    horaInicio: string | null; // HH:MM
    horaFin: string | null; // HH:MM
    duracionMinutos: number | null;
};

// Calcula la hora de fin sumando los minutos del servicio
function calcularHoraFin(horaInicioStr: string, duracionMinutos: number): string {
    const [h, m] = horaInicioStr.split(':').map(Number);
    const totalMin = h * 60 + m + duracionMinutos;
    const hFin = Math.floor(totalMin / 60);
    const mFin = totalMin % 60;
    return `${hFin.toString().padStart(2, '0')}:${mFin.toString().padStart(2, '0')}`;
}

export async function crearCita(payload: CrearCitaPayload) {
    if (!USER_ID) {
        throw new Error('Falta VITE_NEGOCIO_USER_ID en las variables de entorno.');
    }

    const horaFin = calcularHoraFin(payload.horaInicio, payload.duracionMinutos);

    const { data, error } = await supabase
        .from('citas')
        .insert([
            {
                user_id: USER_ID,
                servicio_id: payload.servicioId,
                cliente_id: payload.clienteId||null,
                cliente_nombre: payload.nombreCliente,
                cliente_numero: payload.telefonoCliente,
                fecha_inicio: payload.fechaInicio,
                hora_inicio: payload.horaInicio,
                hora_fin: horaFin,
                duracion_servicio: payload.duracionMinutos,
                estado: 'AGENDADO',
            },
        ])
        .select()
        .single();

    if (error) {
        console.error('Error al insertar cita en Supabase:', error);
        throw error;
    }

    return data;
}
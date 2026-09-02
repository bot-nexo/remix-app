import { supabase } from '../lib/supabase'; // Asegúrate de ajustar la ruta a tu cliente de Supabase

export type Citas = {
    idCita: string;
    userId: string;
    servicioId: string;
    clienteId: string;
    nombreCliente: string;
    telefonoCliente: string;
    fechaInicio: string;
    horaInicio: string;
    horaFin: string;
    duracionMinutos: number;
    estadoCita: string;
    createdAt: string;
};

export async function obtenerMisCitas(clienteId: string): Promise<Citas[] | null> {
    const { data, error } = await supabase
        .from('citas')
        .select(`
            *,
            servicios (
                id,
                nombre,
                valor,
                duracion_minutos
            )
        `)
        .eq('cliente_id', clienteId);

    if (error) {
        console.error('Error al cargar la información de las citas:', error);
        return null;
    }

    return data as Citas[];
};

export async function obtenerActivas(clienteId: string): Promise<Citas[] | null> {
    const { data, error } = await supabase
        .from('citas')
        .select(`
            *,
            servicios (
                id,
                nombre,
                valor,
                duracion_minutos
            )
        `)
        .eq('cliente_id', clienteId)
        .eq('estado', 'AGENDADO');

    if (error) {
        console.error('Error al cargar la información de las citas:', error);
        return null;
    }
    return data as Citas[];
}

export async function cancelarCita(idCita: string) {
    const { data, error } = await supabase
        .from('citas')
        .update({ estado: 'CANCELADO' })
        .eq('id', idCita).
        select();

    if (error) {
        console.error('Error al cancelar la cita:', error);
        return false;
    }
    // Si data tiene elementos, significa que encontró la cita y la actualizó
    const exito = data !== null && data.length > 0;

    if (!exito) {
        console.warn('No se encontró ninguna cita con el ID proporcionado.');
    }

    return exito;
};

export async function reagendarCita(
    idCita: string, 
    nuevaFecha: string, 
    nuevaHoraInicio: string,
    duracionMinutos: number
): Promise<boolean> {
    try {
        // 1. Calcular la nueva hora de finalización (HH:mm:ss)
        const [horas, minutos] = nuevaHoraInicio.split(':').map(Number);
        const fechaAux = new Date();
        fechaAux.setHours(horas, minutos + duracionMinutos, 0);
        const nuevaHoraFin = fechaAux.toTimeString().slice(0, 5); // Formato HH:mm

        // 2. Actualizar el registro en Supabase
        const { data, error } = await supabase
            .from('citas')
            .update({
                fecha_inicio: nuevaFecha,
                hora_inicio: nuevaHoraInicio,
                hora_fin: nuevaHoraFin,
                estado: 'AGENDADO' // Reafirma el estado por si estaba en otro flujo
            })
            .eq('id', idCita)
            .select();

        if (error) {
            console.error('Error al reagendar la cita:', error);
            return false;
        }

        // 3. Validar si la cita existía y se actualizó correctamente
        const exito = data !== null && data.length > 0;

        if (!exito) {
            console.warn('No se encontró ninguna cita con el ID proporcionado para reagendar.');
        }

        return exito;

    } catch (err) {
        console.error('Error inesperado al reagendar la cita:', err);
        return false;
    }
}



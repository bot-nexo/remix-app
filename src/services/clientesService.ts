import { supabase } from '../lib/supabase';
import { Cliente, Cita } from '../types/types';

export interface FiltrosClientes {
  pagina: number;
  limite: number;
  busqueda?: string;
  orden?: 'reciente' | 'antiguo' | 'nombre_asc' | 'nombre_desc';
}

export interface RespuestaClientesPaginados {
  clientes: Cliente[];
  total: number;
  pagina: number;
  totalPaginas: number;
}

/**
 * Obtener listado de clientes paginado con filtrado y ordenamiento
 */
export async function obtenerClientesPaginados({
  pagina = 1,
  limite = 10,
  busqueda = '',
  orden = 'reciente',
}: FiltrosClientes): Promise<RespuestaClientesPaginados> {
  const offset = (pagina - 1) * limite;

  let query = supabase
    .from('clientes')
    .select('*', { count: 'exact' });

  // Aplicar filtro de búsqueda por nombre o número
  if (busqueda && busqueda.trim() !== '') {
    const term = `%${busqueda.trim()}%`;
    query = query.or(`nombre.ilike.${term},numero.ilike.${term}`);
  }

  // Aplicar ordenamiento
  switch (orden) {
    case 'antiguo':
      query = query.order('created_at', { ascending: true });
      break;
    case 'nombre_asc':
      query = query.order('nombre', { ascending: true });
      break;
    case 'nombre_desc':
      query = query.order('nombre', { ascending: false });
      break;
    case 'reciente':
    default:
      query = query.order('created_at', { ascending: false });
      break;
  }

  // Paginación por rango
  query = query.range(offset, offset + limite - 1);

  const { data, count, error } = await query;

  if (error) {
    console.error('Error al obtener clientes paginados:', error);
    throw new Error(error.message || 'Error al obtener clientes.');
  }

  const total = count || 0;
  const totalPaginas = Math.ceil(total / limite) || 1;

  return {
    clientes: (data as Cliente[]) || [],
    total,
    pagina,
    totalPaginas,
  };
}

export async function crearCliente(cliente: { nombre: string; numero: string; lid?: string }): Promise<Cliente> {
  const cleanPhone = cliente.numero ? cliente.numero.replace(/\D/g, '') : '';
  const numToUse = cleanPhone || cliente.numero.trim();
  const last10 = cleanPhone.length >= 7 ? cleanPhone.slice(-10) : numToUse;

  // 1. Buscar si la clienta ya existe por número exacto o por coincidencia de los últimos dígitos
  if (numToUse) {
    const { data: existente } = await supabase
      .from('clientes')
      .select('*')
      .or(`numero.eq.${numToUse},numero.eq.+${numToUse},numero.ilike.%${last10}`)
      .limit(1)
      .maybeSingle();

    if (existente) {
      const updates: any = {};
      if (cliente.nombre.trim() && (existente.nombre === 'Cliente WhatsApp' || existente.nombre === 'Cliente Directo' || !existente.nombre)) {
        updates.nombre = cliente.nombre.trim();
      }
      if (!existente.numero || existente.numero !== numToUse) {
        updates.numero = numToUse;
      }
      if (Object.keys(updates).length > 0) {
        const { data: updated } = await supabase
          .from('clientes')
          .update(updates)
          .eq('id', existente.id)
          .select()
          .single();
        return (updated as Cliente) || (existente as Cliente);
      }
      return existente as Cliente;
    }
  }

  // 2. Insertar nuevo cliente
  const { data, error } = await supabase
    .from('clientes')
    .insert([
      {
        nombre: cliente.nombre.trim(),
        numero: numToUse || null,
        lid: cliente.lid || null,
      },
    ])
    .select()
    .single();

  if (error) {
    // Si la inserción falló con 23505 o HTTP 409 (duplicado), recuperarla de forma flexible
    if (error.code === '23505' || (error as any).status === 409) {
      const { data: existente } = await supabase
        .from('clientes')
        .select('*')
        .or(`numero.eq.${numToUse},numero.eq.+${numToUse},numero.ilike.%${last10}`)
        .limit(1)
        .maybeSingle();

      if (existente) return existente as Cliente;
    }
    console.error('Error al crear cliente:', error);
    throw new Error(error.message || 'Error al guardar cliente.');
  }

  return data as Cliente;
}

/**
 * Actualizar datos de un cliente
 */
export async function actualizarCliente(
  id: string,
  cliente: { nombre: string; numero: string }
): Promise<Cliente> {
  const { data, error } = await supabase
    .from('clientes')
    .update({
      nombre: cliente.nombre.trim(),
      numero: cliente.numero.trim(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error al actualizar cliente:', error);
    throw new Error(error.message || 'Error al actualizar cliente.');
  }

  return data as Cliente;
}

/**
 * Eliminar un cliente de la base de datos
 */
export async function eliminarCliente(id: string): Promise<void> {
  const { error } = await supabase.from('clientes').delete().eq('id', id);

  if (error) {
    console.error('Error al eliminar cliente:', error);
    throw new Error(error.message || 'No se pudo eliminar el cliente.');
  }
}

/**
 * Obtener el historial de citas asociadas a un número de cliente
 */
export async function obtenerHistorialCliente(numeroCliente: string): Promise<Cita[]> {
  if (!numeroCliente) return [];

  const { data, error } = await supabase
    .from('citas')
    .select(`
      id,
      cliente_nombre,
      cliente_numero,
      fecha_inicio,
      hora_inicio,
      hora_fin,
      estado,
      servicios ( nombre, valor )
    `)
    .eq('cliente_numero', numeroCliente)
    .order('fecha_inicio', { ascending: false });

  if (error) {
    console.error('Error obteniendo historial de citas:', error);
    return [];
  }

  return (data as any) || [];
}

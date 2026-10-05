export type Servicio = {
  id: string;
  nombre: string;
  valor: number;
  duracion_minutos: number;
  activo?: boolean | any;
};

export type EmpresaConfig = {
  id: string;
  user_id: string;
  nombre: string;
  direccion: string;
  horario: string | null;
  politicas: string | null;
  color_primario: string;
  color_secundario: string;
  logo_url: string | null;
  nom_bot: string | null;
};

export type DatosCliente = {
  id?: string;
  nombre: string;
  telefono: string;
};

export type Paso = 'menu' | 'servicio' | 'fecha' | 'hora' | 'datos' | 'confirmar' | 'exito' | 'info_empresa' |
'cancelar_cita' |'modificar_cita'| 'humano' | 'servicios_precios' | 'consultar_cita' | 'en_construccion';

export interface Toast {
  id: number;
  tipo: 'success' | 'error' | 'warning';
  mensaje: string;
}

export interface CitaResumen {
  id: string;
  cliente_nombre: string;
  hora_inicio: string;
  estado: string;
  servicios: { nombre: string } | null;
}

export interface ServicioPopular {
  nombre: string;
  total: number;
  porcentaje: number;
}

export interface Cita {
  id: string;
  cliente_nombre: string;
  cliente_numero: string;
  fecha_inicio: string;
  hora_inicio: string;
  hora_fin: string;
  estado: string;
  servicios: { nombre: string; valor?: number } | null;
}

export type FiltroRango = 'hoy' | 'semana' | 'mes' | 'todas';

export interface Contacto {
  id: string;
  nombre_contacto: string;
  numero_whatsapp: string;
}

export interface Cliente {
  id: string;
  nombre: string;
  numero: string | null;
  lid?: string | null;
  created_at: string;
  total_citas?: number;
  ultima_cita?: string | null;
}


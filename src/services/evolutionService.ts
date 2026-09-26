/**
 * Servicio para interactuar con Evolution API (WhatsApp)
 *
 * En producción se configura VITE_AUTORESPONDER_URL con la URL del microservicio.
 * La API key de Evolution solo existe en el servidor.
 *
 * La instancia activa se configura en el microservicio.
 */

import { supabase } from '../lib/supabase';

const AUTORESPONDER_URL = import.meta.env.DEV
  ? '/autoresponder-api'
  : import.meta.env.VITE_AUTORESPONDER_URL || '';

if (!AUTORESPONDER_URL) {
  console.warn('Falta VITE_AUTORESPONDER_URL para conectar WhatsApp.');
}

// ─── Tipos ──────────────────────────────────────────────────────────────────

export interface EvolutionInstance {
  instanceName: string;
  instanceId: string;
  integration: string;
  connectionStatus: string;
  owner?: string;
  number?: string;
  profileName?: string;
  createdAt?: string;
}

export interface QRCodeResponse {
  base64?: string;
  code?: string;
  pairingCode?: string;
  instance?: {
    instanceName: string;
    state: string;
  };
}

export interface ConnectionState {
  instance: {
    instanceName: string;
    state: string;
  };
}

export interface InstanceInfo {
  instanceName: string;
  connectionStatus: string;
  id?: string;
  name?: string;
  ownerJid?: string;
  number?: string;
  profileName?: string;
  integration?: string;
}

export interface FetchInstancesResponse {
  instances: InstanceInfo[];
}

// ─── Helpers ────────────────────────────────────────────────────────────────

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !session?.access_token) {
    throw new Error('Debes iniciar sesión para administrar WhatsApp.');
  }

  const headers = new Headers(options.headers);
  headers.set('Authorization', `Bearer ${session.access_token}`);
  if (options.body) headers.set('Content-Type', 'application/json');

  const url = `${AUTORESPONDER_URL.replace(/\/$/, '')}/api/evolution${path}`;
  const res = await fetch(url, { ...options, headers });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Error del servicio de WhatsApp (${res.status}): ${text}`);
  }
  return res.json() as Promise<T>;
}

// ─── Funciones públicas ─────────────────────────────────────────────────────

/**
 * Verificar si la configuración de Evolution API está disponible
 */
export function isEvolutionConfigured(): boolean {
  return Boolean(AUTORESPONDER_URL);
}

/**
 * Crear la instancia de WhatsApp (si no existe aún).
 * Retorna la info de la instancia y el token de autenticación.
 */
export async function createInstance(): Promise<{ instance: EvolutionInstance }> {
  const data = await apiFetch<{ instance: EvolutionInstance }>('/instance/create', {
    method: 'POST',
  });
  return { instance: data.instance };
}

/**
 * Obtener el QR code para conectar WhatsApp.
 * Retorna el QR en base64 y el estado de la instancia.
 */
export async function getQRCode(): Promise<QRCodeResponse> {
  const data = await apiFetch<QRCodeResponse>(
    '/instance/connect',
    { method: 'GET' }
  );
  return data;
}

/**
 * Verificar el estado de conexión de la instancia.
 */
export async function getConnectionState(): Promise<ConnectionState> {
  const data = await apiFetch<ConnectionState>(
    '/instance/connection-state',
    { method: 'GET' }
  );
  return data;
}

/**
 * Obtener información de las instancias.
 */
export async function fetchInstances(): Promise<InstanceInfo[]> {
  const data = await apiFetch<FetchInstancesResponse>(
    '/instances',
    { method: 'GET' }
  );
  return data.instances || [];
}

/**
 * Reiniciar la instancia (sin perder la sesión).
 */
export async function restartInstance(): Promise<any> {
  return apiFetch('/instance/restart', {
    method: 'PUT',
  });
}

/**
 * Cerrar sesión de WhatsApp (desconectar).
 * Mantiene la instancia pero elimina la sesión.
 */
export async function logoutInstance(): Promise<any> {
  return apiFetch('/instance/logout', {
    method: 'DELETE',
  });
}

/**
 * Eliminar la instancia completamente.
 */
export async function deleteInstance(): Promise<any> {
  return apiFetch('/instance/delete', {
    method: 'DELETE',
  });
}

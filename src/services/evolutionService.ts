/**
 * Servicio para interactuar con Evolution API (WhatsApp)
 * 
 * Requiere las siguientes variables de entorno:
 *   VITE_EVOLUTION_URL  - URL base del servidor Evolution API (ej: https://api.evolution.com.br)
 *   VITE_EVOLUTION_KEY  - API Key global de Evolution API
 * 
 * Se usa una sola instancia para todos los usuarios: "angel-nails"
 */

const EVOLUTION_URL = import.meta.env.VITE_EVOLUTION_URL || '';
const EVOLUTION_KEY = import.meta.env.VITE_EVOLUTION_KEY || '';
const INSTANCE_NAME = 'agentepaula';

// En desarrollo usamos el proxy de Vite para evitar CORS
// En producción se usa la URL directa
const API_BASE = import.meta.env.DEV ? '/evolution-api' : EVOLUTION_URL;

if (!EVOLUTION_URL || !EVOLUTION_KEY) {
  console.warn('Faltan variables de entorno de Evolution API. Configúralas para conectar WhatsApp.');
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

/**
 * Todas las operaciones de instancia (connect, logout, delete, fetchInstances, etc.)
 * usan la API Key global. El token de instancia (hash) es solo para envío de mensajes.
 */
function globalHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'apikey': EVOLUTION_KEY,
  };
}

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE.replace(/\/$/, '')}${path}`;
  const res = await fetch(url, options);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Evolution API error ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

// ─── Funciones públicas ─────────────────────────────────────────────────────

/**
 * Verificar si la configuración de Evolution API está disponible
 */
export function isEvolutionConfigured(): boolean {
  return Boolean(EVOLUTION_URL && EVOLUTION_KEY);
}

/**
 * Obtener el nombre de la instancia
 */
export function getInstanceName(): string {
  return INSTANCE_NAME;
}

/**
 * Crear la instancia de WhatsApp (si no existe aún).
 * Retorna la info de la instancia y el token de autenticación.
 */
export async function createInstance(): Promise<{ instance: EvolutionInstance; token: string }> {
  const data = await apiFetch<any>('/instance/create', {
    method: 'POST',
    headers: globalHeaders(),
    body: JSON.stringify({
      instanceName: INSTANCE_NAME,
      qrcode: true,
      integration: 'WHATSAPP-BAILEYS',
    }),
  });
  return {
    instance: data.instance as EvolutionInstance,
    token: data.hash as string,
  };
}

/**
 * Obtener el QR code para conectar WhatsApp.
 * Retorna el QR en base64 y el estado de la instancia.
 * NOTA: Este endpoint SIEMPRE usa la API Key global.
 */
export async function getQRCode(): Promise<QRCodeResponse> {
  const data = await apiFetch<QRCodeResponse>(
    `/instance/connect/${INSTANCE_NAME}`,
    { method: 'GET', headers: globalHeaders() }
  );
  return data;
}

/**
 * Verificar el estado de conexión de la instancia.
 */
export async function getConnectionState(): Promise<ConnectionState> {
  const data = await apiFetch<ConnectionState>(
    `/instance/connectionState/${INSTANCE_NAME}`,
    { method: 'GET', headers: globalHeaders() }
  );
  return data;
}

/**
 * Obtener información de las instancias.
 */
export async function fetchInstances(): Promise<InstanceInfo[]> {
  const data = await apiFetch<FetchInstancesResponse>(
    `/instance/fetchInstances?instanceName=${INSTANCE_NAME}`,
    { method: 'GET', headers: globalHeaders() }
  );
  return data.instances || [];
}

/**
 * Reiniciar la instancia (sin perder la sesión).
 */
export async function restartInstance(): Promise<any> {
  return apiFetch(`/instance/restart/${INSTANCE_NAME}`, {
    method: 'PUT',
    headers: globalHeaders(),
  });
}

/**
 * Cerrar sesión de WhatsApp (desconectar).
 * Mantiene la instancia pero elimina la sesión.
 */
export async function logoutInstance(): Promise<any> {
  return apiFetch(`/instance/logout/${INSTANCE_NAME}`, {
    method: 'DELETE',
    headers: globalHeaders(),
  });
}

/**
 * Eliminar la instancia completamente.
 */
export async function deleteInstance(): Promise<any> {
  return apiFetch(`/instance/delete/${INSTANCE_NAME}`, {
    method: 'DELETE',
    headers: globalHeaders(),
  });
}

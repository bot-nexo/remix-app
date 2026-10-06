import { AlertCircle, Bot, Eye, EyeOff, KeyRound, Link2, Loader2, Lock, MessageCircle, Phone, RefreshCw, Save, Unlink } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useModules } from '../contexts/ModuleContext';
import { supabase } from '../lib/supabase';
import {
    createInstance,
    fetchInstances,
    getConnectionState,
    getQRCode,
    isEvolutionConfigured,
    logoutInstance,
    type InstanceInfo,
} from '../services/evolutionService';

type ConnectionStatus = 'checking' | 'connected' | 'disconnected' | 'connecting' | 'error';

const WA_STATUS_MAP: Record<string, ConnectionStatus> = {
  CONNECTED: 'connected',
  OPEN: 'connected',
  DISCONNECTED: 'disconnected',
  CLOSE: 'disconnected',
  CONNECTING: 'connecting',
  QR_CODE: 'connecting',
};

function mapWAStatus(status: string): ConnectionStatus {
  return WA_STATUS_MAP[status.toUpperCase()] || 'disconnected';
}

export default function Configuracion() {
  const { showToast } = useToast();
  const { user } = useAuth();
  const { isModuleEnabled } = useModules();
  const [botActive, setBotActive] = useState(false);
  const [tolerancia, setTolerancia] = useState('15');
  const [metaVentas, setMetaVentas] = useState('1000000');
  const [metaVentasActual, setMetaVentasActual] = useState('0');
  const [telefonoProfesional, setTelefonoProfesional] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Password change state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [updatingPassword, setUpdatingPassword] = useState(false);

  // WhatsApp QR state
  const [waStatus, setWaStatus] = useState<ConnectionStatus>('checking');
  const [qrBase64, setQrBase64] = useState<string | null>(null);
  const [waLoading, setWaLoading] = useState(false);
  const [instanceInfo, setInstanceInfo] = useState<InstanceInfo | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // QR auto-refresh (expira en ~60s)
  const QR_EXPIRY_SECONDS = 55;
  const [qrCountdown, setQrCountdown] = useState(0);
  const qrTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const formatCurrency = (v: number) => `$${Number(v).toLocaleString('es-CO')}`;

  // ─── Config data ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    fetchConfig();
  }, [user]);

  // ─── WhatsApp connection check on mount ─────────────────────────────────
  useEffect(() => {
    if (!isEvolutionConfigured()) {
      setWaStatus('error');
      return;
    }
    checkWhatsAppStatus();
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
      if (qrTimerRef.current) clearInterval(qrTimerRef.current);
    };
  }, []);

  const fetchConfig = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('configuracion')
      .select('clave, valor')
      .eq('user_id', user!.id);

    if (data) {
      data.forEach((item) => {
        if (item.clave === 'bot_activo') setBotActive(item.valor === 'true');
        if (item.clave === 'bot_tolerancia') setTolerancia(item.valor);
        if (item.clave === 'meta_ventas_mes') {
          setMetaVentas(item.valor);
          setMetaVentasActual(item.valor);
        }
        if (item.clave === 'telefono_profesional') setTelefonoProfesional(item.valor);
      });
    }
    setLoading(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    const configs = [
      { user_id: user.id, clave: 'bot_activo', valor: botActive.toString() },
      { user_id: user.id, clave: 'bot_tolerancia', valor: tolerancia },
      { user_id: user.id, clave: 'meta_ventas_mes', valor: metaVentas },
      { user_id: user.id, clave: 'telefono_profesional', valor: telefonoProfesional.trim() },
    ];
    try {
      const { error } = await supabase
        .from('configuracion')
        .upsert(configs, { onConflict: 'user_id, clave' });

      if (error) throw error;
      setMetaVentasActual(metaVentas);
      showToast('Configuración guardada correctamente.', 'success');
    } catch (err: any) {
      showToast('Error al guardar la configuración.', 'error');
    } finally {
      setSaving(false);
    }
  };

  // ─── WhatsApp functions ─────────────────────────────────────────────────

  const stopPolling = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  };

  const stopQRCountdown = () => {
    if (qrTimerRef.current) {
      clearInterval(qrTimerRef.current);
      qrTimerRef.current = null;
    }
    setQrCountdown(0);
  };

  const startQRCountdown = () => {
    stopQRCountdown();
    setQrCountdown(QR_EXPIRY_SECONDS);
    qrTimerRef.current = setInterval(() => {
      setQrCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(qrTimerRef.current!);
          qrTimerRef.current = null;
          showToast('QR expiró, generando nuevo...', 'warning');
          setTimeout(() => requestQR(), 0);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const startPolling = () => {
    stopPolling();
    pollingRef.current = setInterval(async () => {
      try {
        const state = await getConnectionState();
        const status = mapWAStatus(state.instance.state);
        if (status === 'connected') {
          setWaStatus('connected');
          setQrBase64(null);
          stopPolling();
          stopQRCountdown();
          showToast('¡WhatsApp conectado exitosamente!', 'success');
        } else if (status === 'connecting') {
          setWaStatus('connecting');
        }
      } catch {
        // silently retry
      }
    }, 4000);
  };

  const checkWhatsAppStatus = async () => {
    setWaStatus('checking');
    try {
      const instances = await fetchInstances();
      if (instances.length > 0) {
        const inst = instances[0];
        setInstanceInfo(inst);
        const status = mapWAStatus(inst.connectionStatus);
        if (status === 'connected') {
          setWaStatus('connected');
          setQrBase64(null);
        } else {
          setWaStatus('disconnected');
          await requestQR();
        }
      } else {
        setWaStatus('disconnected');
      }
    } catch {
      setWaStatus('disconnected');
    }
  };

  const requestQR = async () => {
    setWaLoading(true);
    stopQRCountdown();
    try {
      const qr = await getQRCode();
      if (qr.base64) {
        setQrBase64(qr.base64);
        setWaStatus('connecting');
        startPolling();
        startQRCountdown();
      } else if (qr.instance?.state === 'open') {
        setWaStatus('connected');
        setQrBase64(null);
      }
    } catch (err: any) {
      if (err.message?.includes('404') || err.message?.includes('not found')) {
        try {
          await createInstance();
          const qr = await getQRCode();
          if (qr.base64) {
            setQrBase64(qr.base64);
            setWaStatus('connecting');
            startPolling();
            startQRCountdown();
          } else if (qr.instance?.state === 'open') {
            setWaStatus('connected');
            setQrBase64(null);
          }
        } catch (createErr: any) {
          showToast('Error al crear instancia: ' + createErr.message, 'error');
          setWaStatus('error');
        }
      } else {
        showToast('Error al obtener QR: ' + err.message, 'error');
        setWaStatus('error');
      }
    } finally {
      setWaLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('¿Desconectar WhatsApp? Se perderá la sesión actual.')) return;
    setWaLoading(true);
    stopPolling();
    stopQRCountdown();
    try {
      await logoutInstance();
      setQrBase64(null);
      setWaStatus('disconnected');
      showToast('WhatsApp desconectado.', 'success');
    } catch (err: any) {
      showToast('Error al desconectar: ' + err.message, 'error');
    } finally {
      setWaLoading(false);
    }
  };

  const handleReconnect = async () => {
    stopPolling();
    stopQRCountdown();
    setQrBase64(null);
    await requestQR();
  };

  if (loading) return <div className="p-8 text-center text-sm text-slate-400">Cargando...</div>;

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">Configuración</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          Ajusta el comportamiento de tu asistente
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-5">
        {/* Estado del Asistente */}
        <div className="bg-white dark:bg-[#0f172a] rounded-2xl border border-slate-200/80 dark:border-slate-800/60 p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${botActive ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400' : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500'}`}>
                <Bot size={20} />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Asistente Virtual</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">{botActive ? 'Activo y respondiendo' : 'Pausado'}</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" checked={botActive} onChange={(e) => setBotActive(e.target.checked)} />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-brand-primary/20 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-brand-primary"></div>
            </label>
          </div>
        </div>

        {/* Teléfono del Profesional (Notificaciones) */}
        <div className="bg-white dark:bg-[#0f172a] rounded-2xl border border-slate-200/80 dark:border-slate-800/60 p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Phone size={18} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Teléfono del Profesional</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Recibirá notificaciones cuando un cliente solicite un asesor humano.</p>
            </div>
          </div>
          <div className="mt-2">
            <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">Número de WhatsApp (con código de país)</label>
            <input
              type="text"
              placeholder="Ej: 573001234567"
              value={telefonoProfesional}
              onChange={(e) => setTelefonoProfesional(e.target.value)}
              className="w-full max-w-sm px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/40 focus:border-brand-primary transition-all"
            />
          </div>
        </div>

        {/* Tolerancia */}
        <div className="bg-white dark:bg-[#0f172a] rounded-2xl border border-slate-200/80 dark:border-slate-800/60 p-5">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">Tiempo de Tolerancia</h3>
          <div className="flex items-end gap-3">
            <div className="w-32">
              <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">Minutos</label>
              <input
                type="number" min="0" required value={tolerancia}
                onChange={(e) => setTolerancia(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/40 focus:border-brand-primary transition-all"
              />
            </div>
            <p className="text-xs text-slate-400 dark:text-slate-500 pb-2.5">Tiempo que esperará al cliente antes de marcar inasistencia.</p>
          </div>
        </div>

        {/* ── Conexión WhatsApp (QR) ───────────────────────────────────── */}
        <div className="bg-white dark:bg-[#0f172a] rounded-2xl border border-slate-200/80 dark:border-slate-800/60 p-5">
          <div className="flex items-center gap-4 mb-4">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${waStatus === 'connected'
              ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400'
              : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500'
              }`}>
              <MessageCircle size={20} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">WhatsApp</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {waStatus === 'connected' && '✅ Conectado y listo para recibir mensajes'}
                {waStatus === 'connecting' && '⏳ Esperando escaneo del código QR...'}
                {waStatus === 'disconnected' && 'Desconectado — conecta tu WhatsApp escaneando el QR'}
                {waStatus === 'checking' && 'Verificando estado de conexión...'}
                {waStatus === 'error' && '⚠️ Configura las variables de entorno de Evolution API'}
              </p>
            </div>
          </div>

          {waStatus === 'error' && (
            <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/40 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <AlertCircle size={18} className="text-red-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-red-700 dark:text-red-400">Evolution API no configurada</p>
                  <p className="text-xs text-red-600/70 dark:text-red-400/60 mt-1">
                    Configura <code className="bg-red-100 dark:bg-red-900/30 px-1 rounded">VITE_AUTORESPONDER_URL</code> con la URL pública del microservicio. La clave de Evolution debe permanecer solo en el servidor.
                  </p>
                </div>
              </div>
            </div>
          )}

          {qrBase64 && waStatus === 'connecting' && (
            <div className="flex flex-col items-center gap-4">
              <div className="bg-white p-4 rounded-2xl shadow-lg border border-slate-100 dark:border-slate-700">
                <img
                  src={qrBase64.startsWith('data:') ? qrBase64 : `data:image/png;base64,${qrBase64}`}
                  alt="Código QR de WhatsApp"
                  className="w-56 h-56 object-contain"
                />
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 text-center">
                Abre WhatsApp → Dispositivos vinculados → Vincular dispositivo
              </p>
              <div className="flex items-center gap-1 text-xs text-brand-primary">
                <Loader2 size={14} className="animate-spin" />
                <span>Escaneando...</span>
              </div>
              {qrCountdown > 0 && (
                <div className="flex items-center gap-2">
                  <div className="w-24 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-brand-primary rounded-full transition-all duration-1000"
                      style={{ width: `${(qrCountdown / QR_EXPIRY_SECONDS) * 100}%` }}
                    />
                  </div>
                  <span className="text-[11px] text-slate-400 dark:text-slate-500 tabular-nums">
                    {qrCountdown}s
                  </span>
                </div>
              )}
            </div>
          )}

          {waStatus === 'checking' && (
            <div className="flex items-center justify-center gap-2 py-6">
              <Loader2 size={18} className="animate-spin text-slate-400" />
              <span className="text-sm text-slate-400">Verificando...</span>
            </div>
          )}

          {waStatus !== 'error' && waStatus !== 'checking' && (
            <div className="flex items-center gap-3 mt-4">
              {waStatus === 'disconnected' && (
                <button
                  type="button"
                  onClick={requestQR}
                  disabled={waLoading}
                  className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-semibold transition-all shadow-md disabled:opacity-50"
                >
                  {waLoading ? <Loader2 size={16} className="animate-spin" /> : <Link2 size={16} />}
                  {waLoading ? 'Conectando...' : 'Conectar WhatsApp'}
                </button>
              )}

              {waStatus === 'connected' && (
                <>
                  <div className="flex items-center gap-2 px-4 py-2.5 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 rounded-xl text-sm font-semibold">
                    <Link2 size={16} />
                    Conectado
                  </div>
                  <button
                    type="button"
                    onClick={handleDisconnect}
                    disabled={waLoading}
                    className="flex items-center gap-2 px-4 py-2.5 bg-red-50 hover:bg-red-100 text-red-600 dark:bg-red-950/20 dark:hover:bg-red-950/40 dark:text-red-400 rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
                  >
                    {waLoading ? <Loader2 size={16} className="animate-spin" /> : <Unlink size={16} />}
                    Desconectar
                  </button>
                </>
              )}

              {waStatus === 'connecting' && (
                <button
                  type="button"
                  onClick={handleReconnect}
                  disabled={waLoading}
                  className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
                >
                  <RefreshCw size={16} />
                  Generar nuevo QR
                </button>
              )}
            </div>
          )}
        </div>

        {/* Meta de Ventas */}
        <div className="bg-white dark:bg-[#0f172a] rounded-2xl border border-slate-200/80 dark:border-slate-800/60 p-5">
          <div className="flex items-center gap-2 mb-3">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Meta de Ventas del mes</h3>
            <span className="text-sm font-medium text-brand-primary ml-5 pl-5">
              (Meta actual: {formatCurrency(parseFloat(metaVentasActual) || 0)})
            </span>
          </div>
          <div className="flex items-end gap-3">
            <div className="w-48">
              <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">Monto en pesos</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">$</span>
                <input
                  type="number" min="0" required value={metaVentas}
                  onChange={(e) => setMetaVentas(e.target.value)}
                  className="w-full pl-7 pr-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/40 focus:border-brand-primary transition-all"
                />
              </div>
            </div>
            <p className="text-xs text-slate-400 dark:text-slate-500 pb-2.5">Meta que deseas alcanzar este mes. El dashboard calculará el porcentaje.</p>
          </div>
        </div>

        {/* Guardar */}
        <div className="flex justify-end">
          <button type="submit" disabled={saving} className="flex items-center gap-2 px-6 py-2.5 bg-brand-primary hover:bg-brand-secondary text-white rounded-xl text-sm font-semibold transition-all shadow-md shadow-brand-primary/15 disabled:opacity-50">
            <Save size={16} />
            {saving ? 'Guardando...' : 'Guardar Ajustes Generales'}
          </button>
        </div>
      </form>

      {/* Sección Independiente: Cambiar Contraseña de Administrador */}
      {isModuleEnabled('cambiar-password') ? (
        <div className="bg-white dark:bg-[#0f172a] rounded-2xl border border-slate-200/80 dark:border-slate-800/60 p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-500/10 text-indigo-600 rounded-xl">
              <KeyRound size={22} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Cambiar Contraseña de Administrador</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Actualiza la clave secreta para acceder al panel administrativo.</p>
            </div>
          </div>

          <form onSubmit={async (e) => {
            e.preventDefault();
            if (!newPassword || newPassword.length < 6) {
              showToast('La contraseña debe tener al menos 6 caracteres.', 'error');
              return;
            }
            if (newPassword !== confirmPassword) {
              showToast('Las contraseñas no coinciden.', 'error');
              return;
            }
            setUpdatingPassword(true);
            try {
              const { error } = await supabase.auth.updateUser({ password: newPassword });
              if (error) {
                showToast(`Error al cambiar contraseña: ${error.message}`, 'error');
              } else {
                showToast('¡Contraseña de Administrador actualizada con éxito!', 'success');
                setNewPassword('');
                setConfirmPassword('');
              }
            } catch (err: any) {
              showToast(`Error de conexión: ${err?.message || 'No se pudo actualizar'}`, 'error');
            } finally {
              setUpdatingPassword(false);
            }
          }} className="space-y-4 pt-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">
                  Nueva Contraseña
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    required
                    minLength={6}
                    className="w-full px-4 py-2.5 text-sm border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">
                  Confirmar Contraseña
                </label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repite la contraseña"
                  required
                  minLength={6}
                  className="w-full px-4 py-2.5 text-sm border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all"
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={updatingPassword}
                className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition-all shadow-md shadow-indigo-600/15 disabled:opacity-50"
              >
                <Lock size={16} />
                {updatingPassword ? 'Actualizando Contraseña...' : 'Actualizar Contraseña'}
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2 font-medium">
          <Lock size={16} className="text-slate-400" />
          <span>El cambio de contraseña ha sido deshabilitado por el SuperAdmin.</span>
        </div>
      )}
    </div>
  );
}

import React, { useEffect, useState } from 'react';
import {
  MessageSquareText,
  Save,
  RotateCcw,
  Sparkles,
  Send,
  Smartphone,
  CheckCircle2,
  Info,
  Layers,
  Copy,
  Check,
  Type,
  AlignLeft,
  MousePointerClick,
  Eye,
  Sliders,
  Bot,
  UserCheck,
  Clock,
  Terminal,
} from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';
import {
  PlantillaWhatsapp,
  TipoPlantillaWhatsapp,
  PLANTILLAS_POR_DEFECTO,
  VARIABLES_DISPONIBLES,
  obtenerPlantillasWhatsapp,
  guardarPlantillasWhatsapp,
  estructurarMensajeCompleto,
} from '../services/plantillasWhatsappService';

export default function PlantillasWhatsapp() {
  const { showToast } = useToast();
  const { user } = useAuth();

  // Diccionario de plantillas
  const [plantillas, setPlantillas] = useState<Record<TipoPlantillaWhatsapp, PlantillaWhatsapp>>(
    PLANTILLAS_POR_DEFECTO
  );

  // Plantilla actualmente seleccionada en la pestaña
  const [tipoActivo, setTipoActivo] = useState<TipoPlantillaWhatsapp>('confirmacion');

  // Campo actualmente enfocado para inserción de variables ('titulo' | 'cuerpo' | 'accion')
  const [campoEnfocado, setCampoEnfocado] = useState<'titulo' | 'cuerpo' | 'accion'>('cuerpo');

  // Estados de interfaz
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  // Datos de prueba para la vista previa
  const [datosPrueba, setDatosPrueba] = useState({
    nombre_cliente: 'María Paula Gómez',
    servicio: 'Manicura Rusa Express',
    fecha_cita: '15 de Octubre, 2026',
    hora_cita: '04:00 PM',
    nombre_empresa: 'Angel Nails',
    direccion_empresa: 'Cra 45 # 65-12 piso 2',
    link_reserva: 'https://angelnails.com/reservar',
  });

  // Modal de prueba de envío
  const [modalTestOpen, setModalTestOpen] = useState(false);
  const [testPhone, setTestPhone] = useState('');

  // Cargar plantillas de Supabase
  useEffect(() => {
    if (!user) return;
    async function cargar() {
      setLoading(true);
      try {
        const data = await obtenerPlantillasWhatsapp(user!.id);
        setPlantillas(data);
      } catch (err: any) {
        showToast('No se pudieron cargar las plantillas personalizadas.', 'warning');
      } finally {
        setLoading(false);
      }
    }
    cargar();
  }, [user]);

  const plantillaActual = plantillas[tipoActivo];

  // Actualizar campo de la plantilla activa
  const handleCampoChange = (campo: 'titulo' | 'cuerpo' | 'accion', valor: string) => {
    setPlantillas((prev) => ({
      ...prev,
      [tipoActivo]: {
        ...prev[tipoActivo],
        [campo]: valor,
      },
    }));
  };

  // Insertar variable en el campo actualmente seleccionado
  const handleInsertarVariable = (variable: string) => {
    const textoPrevio = plantillaActual[campoEnfocado] || '';
    handleCampoChange(campoEnfocado, `${textoPrevio} ${variable} `);
    showToast(`Variable ${variable} añadida a ${campoEnfocado}`, 'success');
  };

  // Guardar cambios en Supabase
  const handleGuardar = async () => {
    if (!user) return;
    setSaving(true);
    try {
      await guardarPlantillasWhatsapp(user.id, plantillas);
      showToast('¡Plantillas de WhatsApp guardadas con éxito!', 'success');
    } catch (err: any) {
      showToast(err.message || 'Error al guardar plantillas.', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Restaurar plantilla por defecto
  const handleRestaurarDefecto = () => {
    setPlantillas((prev) => ({
      ...prev,
      [tipoActivo]: { ...PLANTILLAS_POR_DEFECTO[tipoActivo] },
    }));
    showToast(`Plantilla "${plantillaActual.nombre}" restaurada al formato por defecto.`, 'warning');
  };

  // Copiar mensaje completo al portapapeles
  const handleCopiarMensaje = () => {
    const texto = estructurarMensajeCompleto(plantillaActual, datosPrueba);
    navigator.clipboard.writeText(texto);
    setCopied(true);
    showToast('Mensaje de WhatsApp copiado al portapapeles.', 'success');
    setTimeout(() => setCopied(false), 2000);
  };

  // Abrir WhatsApp con el mensaje de prueba
  const handleEnviarTestWhatsApp = () => {
    if (!testPhone.trim()) {
      showToast('Ingresa un número de prueba válido.', 'warning');
      return;
    }
    const cleanNum = testPhone.replace(/\D/g, '');
    const mensajeProcesado = estructurarMensajeCompleto(plantillaActual, datosPrueba);
    const encoded = encodeURIComponent(mensajeProcesado);
    window.open(`https://wa.me/${cleanNum}?text=${encoded}`, '_blank');
    setModalTestOpen(false);
  };

  const mensajeCompletoPreview = estructurarMensajeCompleto(plantillaActual, datosPrueba);

  return (
    <div className="space-y-6 pb-12">
      {/* Header Principal */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
        <div>
          <div className="flex items-center gap-2 text-emerald-600 font-bold text-xs uppercase tracking-wider mb-1">
            <MessageSquareText size={16} /> Automatización WhatsApp
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Personalización de Mensajes de WhatsApp
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            Configura mensajes estructurados con <span className="font-bold text-slate-700 dark:text-slate-200">Título, Cuerpo y Acción</span> para enviar a tus clientes.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleRestaurarDefecto}
            className="inline-flex items-center gap-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs px-4 py-2.5 rounded-xl transition-colors"
          >
            <RotateCcw size={15} />
            <span>Restaurar esta plantilla</span>
          </button>

          <button
            onClick={handleGuardar}
            disabled={saving}
            className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-md shadow-emerald-600/20 transition-all disabled:opacity-50"
          >
            <Save size={16} />
            <span>{saving ? 'Guardando...' : 'Guardar Cambios'}</span>
          </button>
        </div>
      </div>

      {/* Pestañas de Selección de Plantillas */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-slate-200/80 dark:border-slate-800">
        {(Object.keys(PLANTILLAS_POR_DEFECTO) as TipoPlantillaWhatsapp[]).map((key) => {
          const item = plantillas[key] || PLANTILLAS_POR_DEFECTO[key];
          const isActive = tipoActivo === key;
          return (
            <button
              key={key}
              onClick={() => setTipoActivo(key)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all whitespace-nowrap ${
                isActive
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20 scale-[1.02]'
                  : 'bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60'
              }`}
            >
              <Sparkles size={14} className={isActive ? 'text-white' : 'text-emerald-500'} />
              <span>{item.nombre}</span>
            </button>
          );
        })}
      </div>

      {/* Grid Principal: Formulario a la Izquierda, Vista Previa a la Derecha */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Lado Izquierdo: Editor Estructurado */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-5">
            <div>
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Sliders size={18} className="text-emerald-600" />
                  Estructura del Mensaje: {plantillaActual.nombre}
                </h3>
                <span className="text-[11px] font-medium text-slate-400 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-full">
                  Formato WhatsApp
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {plantillaActual.descripcion}
              </p>
            </div>

            {/* Inserción de Variables Dinámicas */}
            <div className="bg-emerald-50/60 dark:bg-emerald-950/30 p-4 rounded-xl border border-emerald-200/70 dark:border-emerald-800/50 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-emerald-900 dark:text-emerald-300">
                <span className="flex items-center gap-1.5">
                  <Sparkles size={14} /> Variables Dinámicas Disponible (haz clic para insertar en "{campoEnfocado}")
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {VARIABLES_DISPONIBLES.map((v) => (
                  <button
                    key={v.clave}
                    type="button"
                    onClick={() => handleInsertarVariable(v.clave)}
                    className="text-[11px] font-semibold bg-white dark:bg-slate-800 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 hover:bg-emerald-100 dark:hover:bg-slate-700 px-2.5 py-1 rounded-lg transition-all"
                  >
                    + {v.etiqueta} <span className="opacity-60 font-mono">({v.clave})</span>
                  </button>
                ))}
              </div>
            </div>

            {/* 1. TÍTULO DEL MENSAJE */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Type size={14} className="text-emerald-600" />
                  1. Título / Encabezado del Mensaje <span className="text-emerald-600 font-normal">(Destacado en Negrita)</span>
                </label>
                {campoEnfocado === 'titulo' && (
                  <span className="text-[10px] text-emerald-600 font-semibold bg-emerald-100 dark:bg-emerald-950 px-2 py-0.5 rounded">Campo Activo</span>
                )}
              </div>
              <input
                type="text"
                placeholder="Ej: ✨ CONFIRMACIÓN DE CITA"
                value={plantillaActual.titulo}
                onFocus={() => setCampoEnfocado('titulo')}
                onChange={(e) => handleCampoChange('titulo', e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* 2. CUERPO DEL MENSAJE */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <AlignLeft size={14} className="text-emerald-600" />
                  2. Cuerpo del Mensaje <span className="text-slate-400 font-normal">(Contenido Principal)</span>
                </label>
                {campoEnfocado === 'cuerpo' && (
                  <span className="text-[10px] text-emerald-600 font-semibold bg-emerald-100 dark:bg-emerald-950 px-2 py-0.5 rounded">Campo Activo</span>
                )}
              </div>
              <textarea
                rows={5}
                placeholder="Escribe el mensaje principal..."
                value={plantillaActual.cuerpo}
                onFocus={() => setCampoEnfocado('cuerpo')}
                onChange={(e) => handleCampoChange('cuerpo', e.target.value)}
                className="w-full p-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-sans leading-relaxed"
              />
            </div>

            {/* 3. ACCIÓN / CALL TO ACTION (CTA) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <MousePointerClick size={14} className="text-emerald-600" />
                  3. Acción / Call to Action (CTA) <span className="text-emerald-600 font-normal">(Instrucción al cliente)</span>
                </label>
                {campoEnfocado === 'accion' && (
                  <span className="text-[10px] text-emerald-600 font-semibold bg-emerald-100 dark:bg-emerald-950 px-2 py-0.5 rounded">Campo Activo</span>
                )}
              </div>
              <input
                type="text"
                placeholder="Ej: Responde 1 para CONFIRMAR o 2 para CANCELAR"
                value={plantillaActual.accion}
                onFocus={() => setCampoEnfocado('accion')}
                onChange={(e) => handleCampoChange('accion', e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <p className="text-[11px] text-slate-400">
                Esta sección se muestra resaltada al final del mensaje para motivar una acción clara.
              </p>
            </div>
          </div>

          {/* Selector de Datos de Prueba para Simulación */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Eye size={14} /> Datos de Simulación para Vista Previa
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">Nombre Cliente</label>
                <input
                  type="text"
                  value={datosPrueba.nombre_cliente}
                  onChange={(e) => setDatosPrueba({ ...datosPrueba, nombre_cliente: e.target.value })}
                  className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">Servicio</label>
                <input
                  type="text"
                  value={datosPrueba.servicio}
                  onChange={(e) => setDatosPrueba({ ...datosPrueba, servicio: e.target.value })}
                  className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">Fecha Cita</label>
                <input
                  type="text"
                  value={datosPrueba.fecha_cita}
                  onChange={(e) => setDatosPrueba({ ...datosPrueba, fecha_cita: e.target.value })}
                  className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">Hora Cita</label>
                <input
                  type="text"
                  value={datosPrueba.hora_cita}
                  onChange={(e) => setDatosPrueba({ ...datosPrueba, hora_cita: e.target.value })}
                  className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Lado Derecho: Simulación Smartphone WhatsApp en Vivo */}
        <div className="lg:col-span-5 space-y-4 sticky top-6">
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Smartphone size={18} className="text-emerald-600" />
                Vista Previa en WhatsApp (Live)
              </h3>
              <div className="flex items-center gap-1">
                <button
                  onClick={handleCopiarMensaje}
                  className="p-2 text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                  title="Copiar texto"
                >
                  {copied ? <Check size={16} className="text-emerald-500" /> : <Copy size={16} />}
                </button>
              </div>
            </div>

            {/* Simulador de WhatsApp Phone UI */}
            <div className="w-full max-w-sm mx-auto bg-[#efeae2] dark:bg-[#0b141a] rounded-[2.5rem] border-8 border-slate-800 dark:border-slate-700 shadow-2xl overflow-hidden flex flex-col h-[530px]">
              {/* WhatsApp Header */}
              <div className="bg-[#075e54] dark:bg-[#202c33] text-white p-3.5 flex items-center gap-3 shrink-0 shadow">
                <div className="w-8 h-8 rounded-full bg-emerald-400/30 flex items-center justify-center font-bold text-xs border border-white/20">
                  AN
                </div>
                <div>
                  <h4 className="text-xs font-bold leading-tight">Angel Nails Studio</h4>
                  <p className="text-[10px] text-emerald-200 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> en línea
                  </p>
                </div>
              </div>

              {/* Chat Canvas */}
              <div
                className="flex-1 p-3.5 overflow-y-auto space-y-3 bg-[radial-gradient(#0000000a_1px,transparent_1px)] dark:bg-[radial-gradient(#ffffff0a_1px,transparent_1px)] [background-size:16px_16px]"
              >
                {/* Indicador de Fecha en Chat */}
                <div className="text-center my-2">
                  <span className="text-[10px] bg-white/80 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 font-semibold px-2.5 py-0.5 rounded-md shadow-sm">
                    HOY
                  </span>
                </div>

                {/* WhatsApp Chat Bubble */}
                <div className="max-w-[88%] ml-auto bg-[#dcf8c6] dark:bg-[#005c4b] text-slate-900 dark:text-slate-100 p-3 rounded-2xl rounded-tr-none shadow-md space-y-2 text-xs relative">
                  
                  {/* Título en Negrita */}
                  {plantillaActual.titulo && (
                    <div className="font-extrabold text-xs border-b border-black/10 dark:border-white/10 pb-1.5 text-[#075e54] dark:text-emerald-300">
                      {estructurarMensajeCompleto({ ...plantillaActual, cuerpo: '', accion: '' }, datosPrueba).replace(/^\*|\*$/g, '')}
                    </div>
                  )}

                  {/* Cuerpo del Mensaje */}
                  {plantillaActual.cuerpo && (
                    <div className="whitespace-pre-wrap leading-relaxed text-[11.5px]">
                      {plantillaActual.cuerpo
                        .split('{nombre_cliente}').join(datosPrueba.nombre_cliente)
                        .split('{servicio}').join(datosPrueba.servicio)
                        .split('{fecha_cita}').join(datosPrueba.fecha_cita)
                        .split('{hora_cita}').join(datosPrueba.hora_cita)
                        .split('{nombre_empresa}').join(datosPrueba.nombre_empresa)
                        .split('{direccion_empresa}').join(datosPrueba.direccion_empresa)
                        .split('{link_reserva}').join(datosPrueba.link_reserva)}
                    </div>
                  )}

                  {/* Bloque Destacado de Acción / CTA */}
                  {plantillaActual.accion && (
                    <div className="mt-2 pt-2 border-t border-black/10 dark:border-white/10 bg-white/40 dark:bg-black/20 p-2 rounded-xl text-[11px] font-semibold text-emerald-900 dark:text-emerald-200">
                      <span className="block font-extrabold text-[10px] uppercase tracking-wider text-emerald-800 dark:text-emerald-400">
                        👉 Acción / Respuesta:
                      </span>
                      {plantillaActual.accion
                        .split('{nombre_cliente}').join(datosPrueba.nombre_cliente)
                        .split('{servicio}').join(datosPrueba.servicio)
                        .split('{fecha_cita}').join(datosPrueba.fecha_cita)
                        .split('{hora_cita}').join(datosPrueba.hora_cita)
                        .split('{nombre_empresa}').join(datosPrueba.nombre_empresa)
                        .split('{link_reserva}').join(datosPrueba.link_reserva)}
                    </div>
                  )}

                  {/* Hora & Ticks */}
                  <div className="text-[9px] text-slate-400 dark:text-emerald-200/70 text-right font-medium flex items-center justify-end gap-1 pt-0.5">
                    <span>14:35</span>
                    <span className="text-blue-500 dark:text-emerald-300 font-bold">✓✓</span>
                  </div>
                </div>
              </div>

              {/* Chat Input Footer Mockup */}
              <div className="bg-[#f0f0f0] dark:bg-[#202c33] p-2 flex items-center gap-2 shrink-0 border-t border-slate-200 dark:border-slate-800">
                <div className="flex-1 bg-white dark:bg-[#2a3942] px-3 py-1.5 rounded-full text-[11px] text-slate-400">
                  Escribe un mensaje...
                </div>
                <div className="w-7 h-7 rounded-full bg-emerald-600 flex items-center justify-center text-white shrink-0">
                  <Send size={12} />
                </div>
              </div>
            </div>

            {/* Enviar Prueba Rápida */}
            <button
              onClick={() => setModalTestOpen(true)}
              className="w-full flex items-center justify-center gap-2 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-400 font-bold text-xs py-3 rounded-xl border border-emerald-200 dark:border-emerald-800 transition-colors"
            >
              <Send size={15} />
              <span>Enviar Prueba a un número de WhatsApp</span>
            </button>
          </div>
        </div>

      </div>

      {/* Modal Prueba de Envío */}
      {modalTestOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-6 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Send size={16} className="text-emerald-600" />
                Enviar Mensaje de Prueba
              </h3>
              <button
                onClick={() => setModalTestOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400">
              Ingresa tu número telefónico para abrir WhatsApp Web/App con este mensaje ya formateado:
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Número de WhatsApp (con indicativo)
              </label>
              <input
                type="text"
                placeholder="Ej: 573001234567"
                value={testPhone}
                onChange={(e) => setTestPhone(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setModalTestOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300"
              >
                Cancelar
              </button>
              <button
                onClick={handleEnviarTestWhatsApp}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-600/20"
              >
                <Send size={14} />
                <span>Abrir WhatsApp</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import { useEffect, useState } from 'react';
import { useToast } from '../contexts/ToastContext';
import { formatearPrecio } from '../functions';
import { crearCita } from '../services/citasService';
import { obtenerHorariosDisponibles } from '../services/disponibilidadService';
import { obtenerEmpresaConfig, obtenerTelefonoProfesional } from '../services/empresaService';
import { DatosCliente, EmpresaConfig, Paso, Servicio } from '../types/types';

import EnDesarrollo from '../components/booking/EnDesarrollo';
import MenuAgenda from '../components/booking/MenuAgenda';
import PasoCancelarCita from '../components/booking/PasoCancelarCita';
import PasoConsultarCita from '../components/booking/PasoConsultarCita';
import PasoDatosCliente from '../components/booking/PasoDatosCliente';
import PasoExito from '../components/booking/PasoExito';
import PasoFecha from '../components/booking/PasoFecha';
import PasoHora from '../components/booking/PasoHora';
import PasoHumano from '../components/booking/PasoHumano';
import PasoInformacionEmpresa from '../components/booking/PasoInformacionEmpresa';
import PasoModificarCita from '../components/booking/PasoModificarCita';
import PasoResumen from '../components/booking/PasoResumen';
import PasoServicio from '../components/booking/PasoServicio';
import PasoServiciosPrecios from '../components/booking/PasoServiciosPrecios';
import { findAngelPalette } from '../constants/angelPalettes';
import AccesoSeguroWhatsApp from '../components/booking/AccesoSeguroWhatsApp';
import { bookingRequest, getBookingErrorMessage, obtenerInformacionPublica } from '../services/bookingApi';
import { reagendarCita } from '../services/misCitas';

//******************************************* */
export default function BookingPage() {
  const [customerAccess] = useState<{ id: string; token: string } | null>(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const id = urlParams.get('id');
    const token = urlParams.get('token');
    if (id && token) {
      try {
        sessionStorage.setItem('booking_access', JSON.stringify({ id, token }));
      } catch {}
      return { id, token };
    }
    try {
      const saved = sessionStorage.getItem('booking_access');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.id && parsed.token) return parsed;
      }
    } catch {}
    return null;
  });

  const idCliente = customerAccess?.id || null;
  const bookingToken = customerAccess?.token || '';
  const { showToast } = useToast();
  const [empresa, setEmpresa] = useState<EmpresaConfig | null>(null);
  const [telefonoProfesional, setTelefonoProfesional] = useState('');
  const [loading, setLoading] = useState(true);
  const palette = findAngelPalette(empresa?.color_primario, empresa?.color_secundario);
  const colorPrimario = palette.primary;
  const colorSecundario = palette.secondary;
  const [paso, setPaso] = useState<Paso>('menu');
  const [opcionMenu, setOpcionMenu] = useState<number | null>(null);
  const [servicioSeleccionado, setServicioSeleccionado] = useState<Servicio | null>(null);
  const [fechaSeleccionada, setFechaSeleccionada] = useState<string>('');
  const [horasDisponibles, setHorasDisponibles] = useState<string[]>([]);
  const [horaSeleccionada, setHoraSeleccionada] = useState<string>('');
  const [cargandoHoras, setCargandoHoras] = useState(false);
  const [cliente, setCliente] = useState<DatosCliente>({ id: '', nombre: '', telefono: '' });
  const [guardandoCita, setGuardandoCita] = useState(false);
  const [errorGuardado, setErrorGuardado] = useState('');
  const hoy = new Date();
  const hoyStr = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
  const [citaAModificar, setCitaAModificar] = useState<any | null>(null);

  //************************************************ */
  useEffect(() => {
    cargarEmpresaInicial();
    if (idCliente && bookingToken) {
      cargarDatosIniciales();
    } else {
      setLoading(false);
    }
  }, [idCliente, bookingToken]);

  async function cargarEmpresaInicial() {
    try {
      const [empresaData, publicData] = await Promise.all([
        obtenerEmpresaConfig(),
        obtenerInformacionPublica().catch(() => null),
      ]);
      if (empresaData) setEmpresa(empresaData);
      if (publicData?.professionalPhone) {
        setTelefonoProfesional(publicData.professionalPhone);
      } else if (empresaData?.user_id) {
        const phone = await obtenerTelefonoProfesional(empresaData.user_id);
        if (phone) setTelefonoProfesional(phone);
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function cargarDatosIniciales() {
    try {
      setLoading(true);
      const [empresaData, bookingContext] = await Promise.all([
        obtenerEmpresaConfig(),
        bookingRequest<{ professionalPhone?: string }>('/context', bookingToken),
      ]);
      setEmpresa(empresaData);
      setTelefonoProfesional(bookingContext.professionalPhone || '');
    } catch (err) {
      console.error(err);
      showToast('No pudimos cargar la información inicial.', 'error');
    } finally {
      setLoading(false);
    }
  }

  function manejarSeleccionMenu(opcion: number) {
    setOpcionMenu(opcion);
    setCitaAModificar(null);
    const pasosMap: Record<number, Paso> = { 1: 'servicio', 2: 'servicios_precios', 3: 'consultar_cita', 4: 'cancelar_cita', 5: 'modificar_cita', 6: 'humano', 7: 'info_empresa' };
    setPaso(pasosMap[opcion] || 'en_construccion');
  }

  async function continuarAHorarios() {
    if (!fechaSeleccionada || !servicioSeleccionado) { showToast('Selecciona una fecha y un servicio.', 'error'); return; }
    try {
      setCargandoHoras(true);
      setPaso('hora');
      setHoraSeleccionada('');
      const slots = await obtenerHorariosDisponibles(fechaSeleccionada, servicioSeleccionado.id, bookingToken, citaAModificar?.id);
      setHorasDisponibles(slots);
    } catch (err) { console.error(err); showToast(getBookingErrorMessage(err, 'No pudimos obtener los horarios.'), 'error'); }
    finally { setCargandoHoras(false); }
  }

  function manejarCambioInput(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const { name, value } = e.target;
    setCliente((prev) => ({ ...prev, [name]: value }));
  }

  function seleccionarCitaParaReagendar(cita: any) {
    setCitaAModificar(cita);
    setServicioSeleccionado({ ...cita.servicios, duracion_minutos: cita.servicios?.duracion_minutos || cita.duracion_servicio || 30 });
    if (cita.cliente_nombre) { setCliente({ id: cita.cliente_id || '', nombre: cita.cliente_nombre || '', telefono: cita.cliente_numero || '' }); }
    setPaso('fecha');
  }

  async function confirmarYGuardarReserva() {
    if (!servicioSeleccionado || !fechaSeleccionada || !horaSeleccionada) { showToast('Complete todos los campos.', 'error'); return; }
    try {
      setGuardandoCita(true);
      if (citaAModificar) {
        await reagendarCita(citaAModificar.id, fechaSeleccionada, horaSeleccionada, bookingToken);
        showToast('Cita reagendada con éxito', 'success');
      } else {
        await crearCita({ servicioId: servicioSeleccionado.id, nombreCliente: cliente.nombre, telefonoCliente: cliente.telefono, fechaInicio: fechaSeleccionada, horaInicio: horaSeleccionada }, bookingToken);
      }
      setPaso('exito');
    } catch (err) {
      console.error(err);
      const message = getBookingErrorMessage(err, 'No se pudo procesar la cita.');
      setErrorGuardado(message);
      showToast(message, 'error');
    }
    finally { setGuardandoCita(false); }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${colorPrimario}08, #0a0a0a)` }}>
        <div className="text-center">
          <div className="w-12 h-12 rounded-full border-2 border-t-transparent animate-spin mx-auto mb-3" style={{ borderColor: `${colorPrimario}40`, borderTopColor: 'transparent' }}></div>
          <p className="text-sm text-slate-500">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!idCliente || !bookingToken) {
    return (
      <AccesoSeguroWhatsApp
        empresa={empresa}
        telefonoProfesional={telefonoProfesional}
        colorPrimario={colorPrimario}
        colorSecundario={colorSecundario}
      />
    );
  }

  const textureMap = {
    'Blush Angel': "url('/catalog-texture-blush.svg')",
    'Rose Champagne': "url('/catalog-texture-rose.svg')",
    'Nude Couture': "url('/catalog-texture-nude.svg')",
  } as const;

  const cssVars = {
    '--brand-primary': colorPrimario,
    '--brand-secondary': colorSecundario,
    '--brand-blush': palette.blush,
    '--brand-gold': palette.gold,
    '--brand-ink': palette.ink,
    '--catalog-texture': textureMap[palette.name as keyof typeof textureMap] || "url('/catalog-texture-blush.svg')",
  } as React.CSSProperties;

    //******************************************* */
  return (
    <main className="booking-surface min-h-screen text-slate-100 selection:bg-white/10" style={cssVars}>
      <div className="mx-auto max-w-lg px-4 py-6 sm:py-10">
        <header className="text-center mb-8">
          {empresa?.logo_url ? (
            <img src={empresa.logo_url} alt={empresa.nombre} className="mx-auto mb-3 h-16 w-16 rounded-2xl object-cover shadow-lg ring-2 ring-white/5" />
          ) : (
            <div className="mx-auto mb-3 h-16 w-16 rounded-2xl flex items-center justify-center text-white font-bold text-2xl shadow-lg" style={{ background: `linear-gradient(135deg, ${colorPrimario}, ${colorSecundario})` }}>
              {empresa?.nombre?.charAt(0) || 'A'}
            </div>
          )}
          <h1 className="text-2xl font-bold tracking-tight text-white">{empresa?.nombre || 'Angel Nails'}</h1>
          <p className="text-xs text-slate-500 mt-1">
            Reserva tu cita en línea
          </p>
        </header>

        {paso === 'menu' && <MenuAgenda onSeleccionarOpcion={manejarSeleccionMenu} empresa={empresa} />}
        {paso === 'servicio' && <PasoServicio servicioSeleccionado={servicioSeleccionado} onSeleccionar={setServicioSeleccionado} onContinuar={() => setPaso('fecha')} formatearPrecio={formatearPrecio} onVolver={() => setPaso('menu')} />}
        {paso === 'fecha' && servicioSeleccionado && <PasoFecha servicioNombre={servicioSeleccionado.nombre} duracionMinutos={servicioSeleccionado.duracion_minutos} fechaSeleccionada={fechaSeleccionada} hoyStr={hoyStr} onFechaChange={setFechaSeleccionada} onContinuar={continuarAHorarios} onVolver={() => citaAModificar ? setPaso('menu') : setPaso('servicio')} textoVolver={citaAModificar ? 'Volver al Menú' : 'Volver a Servicios'} />}
        {paso === 'hora' && <PasoHora servicioNombre={servicioSeleccionado!.nombre} fechaSeleccionada={fechaSeleccionada} horasDisponibles={horasDisponibles} horaSeleccionada={horaSeleccionada} cargandoHoras={cargandoHoras} onHoraSeleccionar={setHoraSeleccionada} onContinuar={() => setPaso('datos')} onVolver={() => setPaso('fecha')} />}
        {paso === 'datos' && <PasoDatosCliente cliente={cliente} onChangeInput={manejarCambioInput} onSubmit={(e) => { e.preventDefault(); setPaso('confirmar'); }} onVolver={() => setPaso('hora')} />}
        {paso === 'confirmar' && servicioSeleccionado && <PasoResumen servicio={servicioSeleccionado} fecha={fechaSeleccionada} hora={horaSeleccionada} cliente={cliente} guardando={guardandoCita} errorGuardado={errorGuardado} onConfirmar={confirmarYGuardarReserva} onVolver={() => setPaso('datos')} formatearPrecio={formatearPrecio} />}
        {paso === 'exito' && servicioSeleccionado && <PasoExito servicio={servicioSeleccionado} fecha={fechaSeleccionada} hora={horaSeleccionada} cliente={cliente} onNuevaReserva={() => { setPaso('menu'); setServicioSeleccionado(null); setFechaSeleccionada(''); setHoraSeleccionada(''); setCliente({ id: '', nombre: '', telefono: '' }); }} />}
        {paso === 'servicios_precios' && <PasoServiciosPrecios onVolver={() => setPaso('menu')} />}
        {paso === 'consultar_cita' && <PasoConsultarCita onVolver={() => setPaso('menu')} idCliente={idCliente} bookingToken={bookingToken} />}
        {paso === 'cancelar_cita' && <PasoCancelarCita onVolver={() => setPaso('menu')} idCliente={idCliente} bookingToken={bookingToken} />}
        {paso === 'modificar_cita' && <PasoModificarCita onVolver={() => setPaso('menu')} idCliente={idCliente} bookingToken={bookingToken} onSeleccionarCita={seleccionarCitaParaReagendar} />}
        {paso === 'humano' && <PasoHumano onVolver={() => setPaso('menu')} empresaNombre={empresa?.nombre} telefonoProfesional={telefonoProfesional} />}
        {paso === 'info_empresa' && <PasoInformacionEmpresa empresa={empresa} onVolver={() => setPaso('menu')} />}
        {paso === 'en_construccion' && <EnDesarrollo onVolver={() => setPaso('menu')} />}

        <footer className="text-center mt-10 pt-6 border-t border-white/5">
          <p className="text-[10px] text-slate-600">© {new Date().getFullYear()} {empresa?.nombre || 'Tu negocio'}</p>
        </footer>
      </div>
    </main>
  );
}

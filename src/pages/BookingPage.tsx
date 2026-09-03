import { useEffect, useState } from 'react';
import { obtenerHorariosDisponibles } from '../services/disponibilidadService';
import { crearCita } from '../services/citasService';
import { DatosCliente, EmpresaConfig, Paso, Servicio } from '../types/types';
import { obtenerEmpresaConfig } from '../services/empresaService';
import { useToast } from '../contexts/ToastContext';
import { formatearPrecio } from '../functions';
import { useAuth } from '../contexts/AuthContext';

import MenuAgenda from '../components/booking/MenuAgenda';
import PasoServicio from '../components/booking/PasoServicio';
import PasoFecha from '../components/booking/PasoFecha';
import PasoHora from '../components/booking/PasoHora';
import PasoDatosCliente from '../components/booking/PasoDatosCliente';
import PasoResumen from '../components/booking/PasoResumen';
import PasoExito from '../components/booking/PasoExito';
import PasoInformacionEmpresa from '../components/booking/PasoInformacionEmpresa';
import PasoServiciosPrecios from '../components/booking/PasoServiciosPrecios';
import EnDesarrollo from '../components/booking/EnDesarrollo';
import PasoConsultarCita from '../components/booking/PasoConsultarCita';
import PasoCancelarCita from '../components/booking/PasoCancelarCita';
import PasoModificarCita from '../components/booking/PasoModificarCita';
import PasoHumano from '../components/booking/PasoHumano';
import { reagendarCita } from '../services/misCitas';

export default function BookingPage() {
  const urlParams = new URLSearchParams(window.location.search);
  const clienteIdFromUrl = urlParams.get('id') || '2c0e4e3d-817f-47e3-bb1d-123d953bbdd7';
  const { showToast } = useToast();
  const { user, signOut } = useAuth();
  const [empresa, setEmpresa] = useState<EmpresaConfig | null>(null);

  // Capturar id del cliente: URL > localStorage > null
  const [idCliente, setIdCliente] = useState<string | null>(() => {
    if (clienteIdFromUrl) {
      localStorage.setItem('angel_cliente_id', clienteIdFromUrl);
      return clienteIdFromUrl;
    }
    return localStorage.getItem('angel_cliente_id');
  });
  const [loading, setLoading] = useState(true);
  const colorPrimario = empresa?.color_primario || '#1083b9ff';
  const colorSecundario = empresa?.color_secundario || '#056196ff';
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

  useEffect(() => {
    if (user) { signOut(); return; }
    cargarDatosIniciales();
  }, [user]);

  // Si no hay idCliente, mostrar error
  if (!idCliente) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: '#0a0a0a' }}>
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">⚠️</span>
          </div>
          <h2 className="text-lg font-bold text-white mb-2">Enlace no válido</h2>
          <p className="text-sm text-slate-400">No se encontró tu identificación de cliente. Por favor accede desde el enlace proporcionado por WhatsApp.</p>
        </div>
      </div>
    );
  }

  async function cargarDatosIniciales() {
    try {
      setLoading(true);
      const [empresaData] = await Promise.all([obtenerEmpresaConfig()]);
      setEmpresa(empresaData);
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
      const slots = await obtenerHorariosDisponibles(fechaSeleccionada, servicioSeleccionado.duracion_minutos);
      setHorasDisponibles(slots);
    } catch (err) { console.error(err); showToast('No pudimos obtener los horarios.', 'error'); }
    finally { setCargandoHoras(false); }
  }

  function manejarCambioInput(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const { name, value } = e.target;
    setCliente((prev) => ({ ...prev, [name]: value }));
  }

  function seleccionarCitaParaReagendar(cita: any) {
    setCitaAModificar(cita);
    setServicioSeleccionado({ ...cita.servicios, duracion_minutos: cita.servicios?.duracion_minutos || cita.duracion_servicio || 30 });
    if (cita.cliente_nombre) { setCliente({ id: cita.cliente_id || '', nombre: cita.cliente_nombre || '', telefono: cita.cliente_telefono || '' }); }
    setPaso('fecha');
  }

  async function confirmarYGuardarReserva() {
    if (!servicioSeleccionado || !fechaSeleccionada || !horaSeleccionada) { showToast('Complete todos los campos.', 'error'); return; }
    try {
      setGuardandoCita(true);
      if (citaAModificar) {
        await reagendarCita(citaAModificar.id, fechaSeleccionada, horaSeleccionada, servicioSeleccionado.duracion_minutos);
        showToast('Cita reagendada con éxito', 'success');
      } else {
        await crearCita({ servicioId: servicioSeleccionado.id, clienteId: idCliente, nombreCliente: cliente.nombre, telefonoCliente: cliente.telefono, fechaInicio: fechaSeleccionada, horaInicio: horaSeleccionada, horaFin: '', duracionMinutos: servicioSeleccionado.duracion_minutos });
      }
      setPaso('exito');
    } catch (err) { console.error(err); setErrorGuardado('Ocurrió un error al procesar tu cita.'); showToast('Error al procesar tu cita.', 'error'); }
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

  const bg = `linear-gradient(180deg, ${colorPrimario}06 0%, #0a0a0a 30%)`;
  const cssVars = { '--brand-primary': colorPrimario, '--brand-secondary': colorSecundario } as React.CSSProperties;

  return (
    <main className="min-h-screen text-slate-100 selection:bg-white/10" style={{ background: bg, ...cssVars }}>
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
          <p className="text-xs text-slate-500 mt-1">Reserva tu cita en línea</p>
        </header>

        {paso === 'menu' && <MenuAgenda onSeleccionarOpcion={manejarSeleccionMenu} empresa={empresa} />}
        {paso === 'servicio' && <PasoServicio servicioSeleccionado={servicioSeleccionado} onSeleccionar={setServicioSeleccionado} onContinuar={() => setPaso('fecha')} formatearPrecio={formatearPrecio} onVolver={() => setPaso('menu')} />}
        {paso === 'fecha' && servicioSeleccionado && <PasoFecha servicioNombre={servicioSeleccionado.nombre} duracionMinutos={servicioSeleccionado.duracion_minutos} fechaSeleccionada={fechaSeleccionada} hoyStr={hoyStr} onFechaChange={setFechaSeleccionada} onContinuar={continuarAHorarios} onVolver={() => citaAModificar ? setPaso('menu') : setPaso('servicio')} textoVolver={citaAModificar ? 'Volver al Menú' : 'Volver a Servicios'} />}
        {paso === 'hora' && <PasoHora servicioNombre={servicioSeleccionado!.nombre} fechaSeleccionada={fechaSeleccionada} horasDisponibles={horasDisponibles} horaSeleccionada={horaSeleccionada} cargandoHoras={cargandoHoras} onHoraSeleccionar={setHoraSeleccionada} onContinuar={() => setPaso('datos')} onVolver={() => setPaso('fecha')} />}
        {paso === 'datos' && <PasoDatosCliente cliente={cliente} onChangeInput={manejarCambioInput} onSubmit={(e) => { e.preventDefault(); setPaso('confirmar'); }} onVolver={() => setPaso('hora')} />}
        {paso === 'confirmar' && servicioSeleccionado && <PasoResumen servicio={servicioSeleccionado} fecha={fechaSeleccionada} hora={horaSeleccionada} cliente={cliente} guardando={guardandoCita} errorGuardado={errorGuardado} onConfirmar={confirmarYGuardarReserva} onVolver={() => setPaso('datos')} formatearPrecio={formatearPrecio} />}
        {paso === 'exito' && servicioSeleccionado && <PasoExito servicio={servicioSeleccionado} fecha={fechaSeleccionada} hora={horaSeleccionada} cliente={cliente} onNuevaReserva={() => { setPaso('menu'); setServicioSeleccionado(null); setFechaSeleccionada(''); setHoraSeleccionada(''); setCliente({ id: '', nombre: '', telefono: '' }); }} />}
        {paso === 'servicios_precios' && <PasoServiciosPrecios onVolver={() => setPaso('menu')} />}
        {paso === 'consultar_cita' && <PasoConsultarCita onVolver={() => setPaso('menu')} idCliente={idCliente} />}
        {paso === 'cancelar_cita' && <PasoCancelarCita onVolver={() => setPaso('menu')} idCliente={idCliente} />}
        {paso === 'modificar_cita' && <PasoModificarCita onVolver={() => setPaso('menu')} idCliente={idCliente} onSeleccionarCita={seleccionarCitaParaReagendar} />}
        {paso === 'humano' && <PasoHumano onVolver={() => setPaso('menu')} empresaNombre={empresa?.nombre} />}
        {paso === 'info_empresa' && <PasoInformacionEmpresa empresa={empresa} onVolver={() => setPaso('menu')} />}
        {paso === 'en_construccion' && <EnDesarrollo onVolver={() => setPaso('menu')} />}

        <footer className="text-center mt-10 pt-6 border-t border-white/5">
          <p className="text-[10px] text-slate-600">© {new Date().getFullYear()} {empresa?.nombre || 'Tu negocio'}</p>
        </footer>
      </div>
    </main>
  );
}

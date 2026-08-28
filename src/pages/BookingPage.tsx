import { useEffect, useState } from 'react';
import { obtenerHorariosDisponibles } from '../services/disponibilidadService';
import { crearCita } from '../services/citasService';
import { DatosCliente, EmpresaConfig, Paso, Servicio } from '../types/types';
import { obtenerEmpresaConfig } from '../services/empresaService';
import { useToast } from '../contexts/ToastContext';
import { formatearPrecio } from '../functions';

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

//******************************* */
export default function BookingPage() {
  const { showToast } = useToast();
  const [empresa, setEmpresa] = useState<EmpresaConfig | null>(null);

  const [loading, setLoading] = useState(true);

  const colorPrimario = empresa?.color_primario || '#10b981';
  const colorSecundario = empresa?.color_secundario || '#059669';

  const [paso, setPaso] = useState<Paso>('menu');

  const [opcionMenu, setOpcionMenu] = useState<number | null>(null);

  const [servicioSeleccionado, setServicioSeleccionado] = useState<Servicio | null>(null);
  const [fechaSeleccionada, setFechaSeleccionada] = useState<string>('');
  const [horasDisponibles, setHorasDisponibles] = useState<string[]>([]);
  const [horaSeleccionada, setHoraSeleccionada] = useState<string>('');
  const [cargandoHoras, setCargandoHoras] = useState(false);

  const [cliente, setCliente] = useState<DatosCliente>({
    id: '',
    nombre: '',
    telefono: '',
  });

  const [guardandoCita, setGuardandoCita] = useState(false);
  const [errorGuardado, setErrorGuardado] = useState('');

  const hoyStr = new Date().toISOString().split('T')[0];

  //********************************** */
  useEffect(() => {
    cargarDatosIniciales();
  }, []);

  async function cargarDatosIniciales() {
    try {
      setLoading(true);
      const [empresaData] = await Promise.all([
        obtenerEmpresaConfig(),
      ]);
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
    if (opcion === 1) {
      setPaso('servicio');
    } else if (opcion === 2) {
      setPaso('servicios_precios');
    } else if (opcion === 3) {
      setPaso('consultar_cita');
    } else if (opcion === 4) {
      setPaso('cancelar_cita');
    } else if (opcion === 5) {
      setPaso('modificar_cita');
    } else if (opcion === 6) {
      setPaso('humano');
    } else if (opcion === 7) {
      setPaso('info_empresa');
    }
    else {
      setPaso('en_construccion');
    }
  }

  async function continuarAHorarios() {
    if (!fechaSeleccionada || !servicioSeleccionado) {
      showToast('Por favor, seleccione una fecha y un servicio.', 'error');
      return;
    }

    try {
      setCargandoHoras(true);
      setPaso('hora');
      setHoraSeleccionada('');

      const slots = await obtenerHorariosDisponibles(
        fechaSeleccionada,
        servicioSeleccionado.duracion_minutos
      );
      setHorasDisponibles(slots);
    } catch (err) {
      console.error(err);
      showToast('No pudimos obtener los horarios disponibles.', 'error');
    } finally {
      setCargandoHoras(false);
    }
  }

  function manejarCambioInput(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const { name, value } = e.target;
    setCliente((prev) => ({ ...prev, [name]: value }));
  }

  async function confirmarYGuardarReserva() {
    if (!servicioSeleccionado || !fechaSeleccionada || !horaSeleccionada) {
      showToast('Por favor, complete todos los campos.', 'error');
      return;
    }

    try {
      setGuardandoCita(true);

      await crearCita({
        servicioId: servicioSeleccionado.id,
        clienteId: cliente.id || null,
        nombreCliente: cliente.nombre,
        telefonoCliente: cliente.telefono,
        fechaInicio: fechaSeleccionada,
        horaInicio: horaSeleccionada,
        horaFin: '',
        duracionMinutos: servicioSeleccionado.duracion_minutos,
      });

      setPaso('exito');
    } catch (err) {
      console.error(err);
      showToast('Ocurrió un error al guardar tu cita. Inténtalo nuevamente.', 'error');
    } finally {
      setGuardandoCita(false);
    }
  }

  //**************************************** */
  return (
    <main
      className="min-h-screen bg-slate-950 text-slate-100 selection:bg-slate-900 selection:text-white"
      style={{
        '--brand-primary': colorPrimario,
        '--brand-secondary': colorSecundario,
      } as React.CSSProperties}
    >
      <div className="mx-auto max-w-xl px-4 py-8">
        <header className="mb-6 text-center">
          {empresa?.logo_url && (
            <img
              src={empresa.logo_url}
              alt={empresa.nombre}
              className="mx-auto mb-3 h-20 w-20 rounded-full object-cover border-3 border-[var(--brand-primary)]"
            />
          )}
          <h1 className="text-3xl font-bold tracking-tight text-white">
            {empresa?.nombre || 'Angel Nails'}
          </h1>
        </header>

        {/*0MENU */}
        {paso === 'menu' && (
          <MenuAgenda onSeleccionarOpcion={manejarSeleccionMenu} empresa={empresa} />
        )}

        {/* 1 INICIO AGENDAR CITA */}
        {paso === 'servicio' && (
          <PasoServicio
            servicioSeleccionado={servicioSeleccionado}
            onSeleccionar={setServicioSeleccionado}
            onContinuar={() => setPaso('fecha')}
            formatearPrecio={formatearPrecio}
            onVolver={() => setPaso('menu')}
          />
        )}

        {paso === 'fecha' && servicioSeleccionado && (
          <PasoFecha
            servicioNombre={servicioSeleccionado.nombre}
            duracionMinutos={servicioSeleccionado.duracion_minutos}
            fechaSeleccionada={fechaSeleccionada}
            hoyStr={hoyStr}
            onFechaChange={setFechaSeleccionada}
            onContinuar={continuarAHorarios}
            onVolver={() => setPaso('servicio')}
          />
        )}

        {paso === 'hora' && (
          <PasoHora
            fechaSeleccionada={fechaSeleccionada}
            horasDisponibles={horasDisponibles}
            horaSeleccionada={horaSeleccionada}
            cargandoHoras={cargandoHoras}
            onHoraSeleccionar={setHoraSeleccionada}
            onContinuar={() => setPaso('datos')}
            onVolver={() => setPaso('fecha')}
          />
        )}

        {paso === 'datos' && (
          <PasoDatosCliente
            cliente={cliente}
            onChangeInput={manejarCambioInput}
            onSubmit={(e) => {
              e.preventDefault();
              setPaso('confirmar');
            }}
            onVolver={() => setPaso('hora')}
          />
        )}

        {paso === 'confirmar' && servicioSeleccionado && (
          <PasoResumen
            servicio={servicioSeleccionado}
            fecha={fechaSeleccionada}
            hora={horaSeleccionada}
            cliente={cliente}
            guardando={guardandoCita}
            errorGuardado={errorGuardado}
            onConfirmar={confirmarYGuardarReserva}
            onVolver={() => setPaso('datos')}
            formatearPrecio={formatearPrecio}
          />
        )}

        {paso === 'exito' && servicioSeleccionado && (
          <PasoExito
            servicio={servicioSeleccionado}
            fecha={fechaSeleccionada}
            hora={horaSeleccionada}
            cliente={cliente}
            onNuevaReserva={() => {
              setPaso('menu');
              setServicioSeleccionado(null);
              setFechaSeleccionada('');
              setHoraSeleccionada('');
              setCliente({ id: '', nombre: '', telefono: '' });
            }}
          />
        )}
        {/* FIN AGENDAR CITA */}

        {/* 2 SERVICIOS Y PRECIOS */}
        {paso === 'servicios_precios' && (
          <PasoServiciosPrecios onVolver={() => setPaso('menu')} />
        )}

        {/* 3 CONSULTAR CITA */}
        {paso === 'consultar_cita' && (
          <PasoConsultarCita onVolver={() => setPaso('menu')} />
        )}

        {/* 4 CANCELAR CITA */}
        {paso === 'cancelar_cita' && (
          <PasoCancelarCita onVolver={() => setPaso('menu')} />
        )}

        {/* 5 REAGENDAR CITA */}
        {paso === 'modificar_cita' && (
          <PasoModificarCita onVolver={() => setPaso('menu')} />
        )}

        {/* 6 HUMANO */}
        {paso === 'humano' && (
          <PasoHumano onVolver={() => setPaso('menu')} />
        )}

        {/* 7 INF EMPRESA */}
        {paso === 'info_empresa' && (
          <PasoInformacionEmpresa empresa={empresa} onVolver={() => setPaso('menu')} />
        )}

        {/* 8 EN DESARROLLO */}
        {paso === 'en_construccion' && (
          <EnDesarrollo onVolver={() => setPaso('menu')} />
        )}
      </div>
    </main>
  );
}
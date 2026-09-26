import {
    Activity,
    ArrowRight,
    ArrowUpRight,
    Bell,
    CalendarDays,
    CalendarPlus,
    Check,
    CheckCheck,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    CircleHelp,
    Clock3,
    Flower2,
    LayoutDashboard,
    Menu,
    MessageCircle,
    Moon,
    MoreHorizontal,
    Plus,
    Search,
    Settings2,
    ShieldCheck,
    Sparkles,
    Sun,
    UserRound,
    UsersRound,
    X
} from 'lucide-react'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import './App.css'
import BookingPortal from './BookingPortal'

type SectionKey = 'overview' | 'agenda' | 'appointments' | 'clients' | 'services' | 'hours' | 'whatsapp'
type AppointmentStatus = 'Confirmada' | 'Por confirmar' | 'Completada'

type Appointment = {
  id: number
  date: string
  time: string
  client: string
  service: string
  duration: string
  price: number
  status: AppointmentStatus
  initials: string
  color: string
}

const navItems = [
  { id: 'overview', label: 'Resumen', icon: LayoutDashboard },
  { id: 'agenda', label: 'Agenda', icon: CalendarDays },
  { id: 'appointments', label: 'Citas', icon: CheckCheck },
  { id: 'clients', label: 'Clientes', icon: UsersRound },
  { id: 'services', label: 'Servicios', icon: Sparkles },
  { id: 'hours', label: 'Horarios', icon: Clock3 },
  { id: 'whatsapp', label: 'WhatsApp', icon: MessageCircle },
] as const

const sectionDetails: Record<SectionKey, { title: string; subtitle: string }> = {
  overview: { title: 'Resumen', subtitle: 'La agenda de tu negocio, en un vistazo.' },
  agenda: { title: 'Agenda', subtitle: 'Organiza el día y cuida cada espacio.' },
  appointments: { title: 'Citas', subtitle: 'Reservas recientes y su estado.' },
  clients: { title: 'Clientes', subtitle: 'Relaciones que hacen crecer el negocio.' },
  services: { title: 'Servicios', subtitle: 'Tu carta de tratamientos y precios.' },
  hours: { title: 'Horarios', subtitle: 'Disponibilidad y excepciones de agenda.' },
  whatsapp: { title: 'WhatsApp', subtitle: 'Canal de atención conectado al negocio.' },
}

const formatDateKey = (date: Date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const demoDate = formatDateKey(new Date())

const initialAppointments: Appointment[] = [
  { id: 1, date: demoDate, time: '09:00', client: 'Valentina Rojas', service: 'Manicure semipermanente', duration: '60 min', price: 68000, status: 'Completada', initials: 'VR', color: 'rose' },
  { id: 2, date: demoDate, time: '10:30', client: 'Camila Torres', service: 'Nivelación + color', duration: '90 min', price: 110000, status: 'Confirmada', initials: 'CT', color: 'mint' },
  { id: 3, date: demoDate, time: '12:30', client: 'Mariana López', service: 'Pedicure spa', duration: '75 min', price: 85000, status: 'Por confirmar', initials: 'ML', color: 'lilac' },
  { id: 4, date: demoDate, time: '14:15', client: 'Isabella Mora', service: 'Diseño y extensión', duration: '120 min', price: 145000, status: 'Confirmada', initials: 'IM', color: 'butter' },
  { id: 5, date: demoDate, time: '16:45', client: 'Lucía Herrera', service: 'Retiro + manicure', duration: '60 min', price: 62000, status: 'Confirmada', initials: 'LH', color: 'sky' },
]

const sampleClients = [
  { name: 'Camila Torres', phone: '+57 310 555 0142', visits: 12, lastVisit: 'Hoy, 10:30' },
  { name: 'Mariana López', phone: '+57 315 555 0187', visits: 8, lastVisit: 'Hoy, 12:30' },
  { name: 'Isabella Mora', phone: '+57 300 555 0125', visits: 5, lastVisit: 'Hoy, 14:15' },
]

const sampleServices = [
  { name: 'Manicure semipermanente', duration: '60 min', price: 68000, bookings: 24 },
  { name: 'Nivelación + color', duration: '90 min', price: 110000, bookings: 18 },
  { name: 'Pedicure spa', duration: '75 min', price: 85000, bookings: 14 },
]

const formatCurrency = (amount: number) => new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
}).format(amount)

const formatLongDate = (date: Date) => new Intl.DateTimeFormat('es-CO', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
}).format(date)

function App() {
  const [activeSurface, setActiveSurface] = useState<'admin' | 'booking'>(() =>
    window.location.pathname.startsWith('/reservar/') ? 'booking' : 'admin',
  )
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const savedTheme = window.localStorage.getItem('alma-v2-theme')
    if (savedTheme === 'light' || savedTheme === 'dark') return savedTheme
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })
  const [activeSection, setActiveSection] = useState<SectionKey>('overview')
  const [appointments, setAppointments] = useState(initialAppointments)
  const [selectedDate, setSelectedDate] = useState(demoDate)
  const [statusFilter, setStatusFilter] = useState<'Todas' | AppointmentStatus>('Todas')
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false)
  const [isAppointmentModalOpen, setIsAppointmentModalOpen] = useState(false)
  const [clientName, setClientName] = useState('')
  const [serviceName, setServiceName] = useState(sampleServices[0].name)
  const [appointmentDate, setAppointmentDate] = useState(demoDate)
  const [appointmentTime, setAppointmentTime] = useState('17:30')
  const [notice, setNotice] = useState('')

  const activeDate = useMemo(() => new Date(`${selectedDate}T12:00:00`), [selectedDate])
  const appointmentsForDate = appointments.filter((appointment) => appointment.date === selectedDate)
  const pageDetails = sectionDetails[activeSection]
  const filteredAppointments = statusFilter === 'Todas'
    ? appointmentsForDate
    : appointmentsForDate.filter((appointment) => appointment.status === statusFilter)
  const pendingAppointments = appointmentsForDate.filter((appointment) => appointment.status === 'Por confirmar').length
  const completedSales = appointmentsForDate
    .filter((appointment) => appointment.status === 'Completada')
    .reduce((total, appointment) => total + appointment.price, 0)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    window.localStorage.setItem('alma-v2-theme', theme)
  }, [theme])

  useEffect(() => {
    const syncSurfaceWithLocation = () => {
      setActiveSurface(window.location.pathname.startsWith('/reservar/') ? 'booking' : 'admin')
    }
    window.addEventListener('popstate', syncSurfaceWithLocation)
    return () => window.removeEventListener('popstate', syncSurfaceWithLocation)
  }, [])

  function openBookingPortal() {
    window.history.pushState({}, '', '/reservar/angel-nails')
    setActiveSurface('booking')
  }

  function openAdminPanel() {
    window.history.pushState({}, '', '/')
    setActiveSurface('admin')
  }

  function selectSection(section: SectionKey) {
    setActiveSection(section)
    setIsMobileNavOpen(false)
  }

  function shiftSelectedDate(offset: number) {
    const nextDate = new Date(`${selectedDate}T12:00:00`)
    nextDate.setDate(nextDate.getDate() + offset)
    setSelectedDate(formatDateKey(nextDate))
    setAppointmentDate(formatDateKey(nextDate))
    setStatusFilter('Todas')
  }

  function openNewAppointment() {
    setAppointmentDate(selectedDate)
    setIsAppointmentModalOpen(true)
  }

  function handleCreateAppointment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!clientName.trim()) return

    const selectedService = sampleServices.find((service) => service.name === serviceName) ?? sampleServices[0]
    const nextAppointment: Appointment = {
      id: Date.now(),
      date: appointmentDate,
      time: appointmentTime,
      client: clientName.trim(),
      service: selectedService.name,
      duration: selectedService.duration,
      price: selectedService.price,
      status: 'Por confirmar',
      initials: clientName.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join(''),
      color: 'mint',
    }

    setAppointments((current) => [...current, nextAppointment].sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time)))
    setSelectedDate(appointmentDate)
    setClientName('')
    setIsAppointmentModalOpen(false)
    setNotice('Cita añadida a la vista de demostración.')
    window.setTimeout(() => setNotice(''), 3500)
  }

  if (activeSurface === 'booking') return <BookingPortal onBackToAdmin={openAdminPanel} theme={theme} onToggleTheme={() => setTheme((current) => current === 'light' ? 'dark' : 'light')} />

  return (
    <div className={`app-shell theme-${theme}`}>
      {isMobileNavOpen && <button className="nav-scrim" aria-label="Cerrar navegación" onClick={() => setIsMobileNavOpen(false)} />}
      <aside className={`sidebar ${isMobileNavOpen ? 'sidebar-open' : ''}`}>
        <div className="brand-lockup">
          <div className="brand-mark"><Flower2 size={21} strokeWidth={1.8} /></div>
          <div className="brand-copy"><strong>alma</strong><span>STUDIO MANAGER</span></div>
        </div>

        <div className="business-switcher">
          <div className="business-avatar">A</div>
          <div className="business-copy"><span>NEGOCIO</span><strong>Angel Nails</strong></div>
          <ChevronDown size={15} />
        </div>

        <nav className="primary-nav" aria-label="Navegación principal">
          <p className="nav-caption">GESTIÓN</p>
          {navItems.map(({ id, label, icon: Icon }) => (
            <button
              className={`nav-link ${activeSection === id ? 'nav-link-active' : ''}`}
              key={id}
              onClick={() => selectSection(id)}
              type="button"
              aria-current={activeSection === id ? 'page' : undefined}
            >
              <Icon size={18} strokeWidth={1.8} />
              <span>{label}</span>
              {id === 'appointments' && pendingAppointments > 0 && <span className="nav-count">{pendingAppointments}</span>}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <button className="nav-link" type="button" onClick={() => setNotice('El centro de ayuda estará disponible en una próxima fase.')}>
            <CircleHelp size={18} strokeWidth={1.8} /><span>Centro de ayuda</span>
          </button>
          <div className="profile-row">
            <div className="profile-avatar">AG</div>
            <div className="profile-copy"><strong>Angel García</strong><span>Propietaria</span></div>
            <MoreHorizontal size={19} />
          </div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <button className="icon-button mobile-menu-button" aria-label="Abrir navegación" onClick={() => setIsMobileNavOpen(true)} type="button"><Menu size={20} /></button>
          <div className="breadcrumb"><span>Angel Nails</span><span className="breadcrumb-divider">/</span><strong>{pageDetails.title}</strong></div>
          <div className="topbar-actions">
            <button className="secondary-button portal-link" type="button" onClick={openBookingPortal} aria-label="Abrir portal cliente" title="Abrir portal cliente"><UserRound size={15} /><span>Portal cliente</span></button>
            <span className="demo-badge"><span /> Entorno de muestra</span>
            <button className="icon-button theme-toggle" type="button" onClick={() => setTheme((current) => current === 'light' ? 'dark' : 'light')} aria-label={`Cambiar a tema ${theme === 'light' ? 'oscuro' : 'claro'}`} title={`Cambiar a tema ${theme === 'light' ? 'oscuro' : 'claro'}`}>{theme === 'light' ? <Moon size={17} /> : <Sun size={17} />}</button>
            <button className="icon-button notification-button" type="button" aria-label="Notificaciones" onClick={() => setNotice('No tienes notificaciones nuevas.')}><Bell size={18} /><i /></button>
          </div>
        </header>

        <div className="page-content">
          <div className="page-heading">
            <div>
              <p className="eyebrow">{new Intl.DateTimeFormat('es-CO', { weekday: 'long' }).format(activeDate).toUpperCase()} · {new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: 'long' }).format(activeDate).toUpperCase()}</p>
              <h1>{pageDetails.title}</h1>
              <p className="page-subtitle">{pageDetails.subtitle}</p>
            </div>
            <button className="primary-button" type="button" onClick={openNewAppointment}>
              <Plus size={17} strokeWidth={2.2} /> <span>Nueva cita</span>
            </button>
          </div>

          {activeSection === 'overview' && (
            <>
              <section className="metric-grid" aria-label="Indicadores del día">
                <article className="metric-card">
                  <div className="metric-top"><span>Citas de hoy</span><span className="metric-icon metric-icon-green"><CalendarDays size={17} /></span></div>
                  <div className="metric-value">{appointmentsForDate.length}<span className="metric-unit"> citas</span></div>
                  <div className="metric-foot"><span className="positive-trend"><ArrowUpRight size={14} /> 2</span><span>vs. sábado anterior</span></div>
                </article>
                <article className="metric-card">
                  <div className="metric-top"><span>Por confirmar</span><span className="metric-icon metric-icon-coral"><Clock3 size={17} /></span></div>
                  <div className="metric-value">{pendingAppointments}<span className="metric-unit"> pendientes</span></div>
                  <div className="metric-foot"><span className="neutral-trend">Atención</span><span>requieren seguimiento</span></div>
                </article>
                <article className="metric-card">
                  <div className="metric-top"><span>Ventas realizadas</span><span className="metric-icon metric-icon-gold"><Activity size={17} /></span></div>
                  <div className="metric-value metric-value-currency">{formatCurrency(completedSales)}</div>
                  <div className="metric-foot"><span className="positive-trend"><ArrowUpRight size={14} /> 12%</span><span>vs. sábado anterior</span></div>
                </article>
              </section>

              <div className="dashboard-grid">
                <AgendaPanel
                  appointments={filteredAppointments}
                  filter={statusFilter}
                  onFilterChange={setStatusFilter}
                  onNewAppointment={openNewAppointment}
                  selectedDate={selectedDate}
                  onShiftDate={shiftSelectedDate}
                  pendingCount={pendingAppointments}
                />
                <aside className="right-rail">
                  <section className="rail-section day-overview">
                    <div className="section-heading"><div><p className="eyebrow">RITMO DEL DÍA</p><h2>Tu {new Intl.DateTimeFormat('es-CO', { weekday: 'long' }).format(activeDate)}</h2></div><button className="icon-button subtle-icon" type="button" aria-label="Ver detalle de actividad"><ArrowRight size={17} /></button></div>
                    <div className="occupancy-number"><strong>68</strong><span>%</span><span className="occupancy-note">de ocupación</span></div>
                    <div className="occupancy-track"><span style={{ width: '68%' }} /></div>
                    <div className="occupancy-meta"><span>09:00 — 19:00</span><span>6 h 50 min reservados</span></div>
                  </section>

                  <section className="rail-section service-highlight">
                    <div className="section-heading"><div><p className="eyebrow">MÁS SOLICITADO</p><h2>Manicure semipermanente</h2></div><span className="sparkle-mark"><Sparkles size={16} /></span></div>
                    <div className="service-chart" aria-label="Reservas por día esta semana">
                      {[34, 52, 42, 74, 58, 92, 46].map((height, index) => <span key={index} className={index === 5 ? 'chart-bar chart-bar-active' : 'chart-bar'} style={{ height: `${height}%` }} />)}
                    </div>
                    <div className="chart-labels"><span>L</span><span>M</span><span>M</span><span>J</span><span>V</span><span>S</span><span>D</span></div>
                    <div className="service-highlight-footer"><span>24 reservas</span><span className="positive-trend"><ArrowUpRight size={14} /> 18%</span></div>
                  </section>

                  <section className="whatsapp-inline"><div className="whatsapp-mark"><MessageCircle size={18} /></div><div><strong>WhatsApp</strong><span>Conecta tu canal de atención</span></div><ArrowRight size={16} /></section>
                </aside>
              </div>
            </>
          )}

          {activeSection === 'agenda' && (
            <AgendaPanel appointments={filteredAppointments} filter={statusFilter} onFilterChange={setStatusFilter} onNewAppointment={openNewAppointment} selectedDate={selectedDate} onShiftDate={shiftSelectedDate} pendingCount={pendingAppointments} expanded />
          )}

          {activeSection === 'appointments' && <AppointmentsTable appointments={filteredAppointments} filter={statusFilter} onFilterChange={setStatusFilter} onNewAppointment={openNewAppointment} selectedDate={selectedDate} onShiftDate={shiftSelectedDate} pendingCount={pendingAppointments} />}
          {activeSection === 'clients' && <ClientsTable />}
          {activeSection === 'services' && <ServicesTable />}
          {activeSection === 'hours' && <HoursOverview />}
          {activeSection === 'whatsapp' && <WhatsAppOverview onConnect={() => setNotice('La conexión con Evolution se habilitará al conectar la API V2.')} />}

          <footer className="page-footer"><ShieldCheck size={14} /><span>Vista de muestra · Los cambios no se guardan en una base de datos</span></footer>
        </div>
      </main>

      {notice && <div className="toast-message" role="status"><Check size={16} />{notice}<button type="button" aria-label="Cerrar aviso" onClick={() => setNotice('')}><X size={15} /></button></div>}

      {isAppointmentModalOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setIsAppointmentModalOpen(false) }}>
          <section className="appointment-modal" role="dialog" aria-modal="true" aria-labelledby="appointment-modal-title">
            <div className="modal-heading"><div><p className="eyebrow">AGENDA · NUEVA RESERVA</p><h2 id="appointment-modal-title">Crear cita</h2></div><button className="icon-button" type="button" aria-label="Cerrar" onClick={() => setIsAppointmentModalOpen(false)}><X size={19} /></button></div>
            <form onSubmit={handleCreateAppointment}>
              <label>Nombre del cliente<input autoFocus required value={clientName} onChange={(event) => setClientName(event.target.value)} placeholder="Ej. Laura Gómez" /></label>
              <label>Servicio<select value={serviceName} onChange={(event) => setServiceName(event.target.value)}>{sampleServices.map((service) => <option key={service.name}>{service.name}</option>)}</select></label>
              <div className="form-row"><label>Fecha<input type="date" value={appointmentDate} onChange={(event) => setAppointmentDate(event.target.value)} required /></label><label>Hora<input type="time" value={appointmentTime} onChange={(event) => setAppointmentTime(event.target.value)} required /></label></div>
              <div className="modal-actions"><button className="secondary-button" type="button" onClick={() => setIsAppointmentModalOpen(false)}>Cancelar</button><button className="primary-button" type="submit"><CalendarPlus size={16} /> Crear cita</button></div>
            </form>
          </section>
        </div>
      )}
    </div>
  )
}

function AgendaPanel({ appointments, filter, onFilterChange, onNewAppointment, selectedDate, onShiftDate, pendingCount, expanded = false }: {
  appointments: Appointment[]
  filter: 'Todas' | AppointmentStatus
  onFilterChange: (value: 'Todas' | AppointmentStatus) => void
  onNewAppointment: () => void
  selectedDate: string
  onShiftDate: (offset: number) => void
  pendingCount: number
  expanded?: boolean
}) {
  const filters: Array<'Todas' | AppointmentStatus> = ['Todas', 'Confirmada', 'Por confirmar', 'Completada']
  const activeDate = new Date(`${selectedDate}T12:00:00`)
  const dateLabel = selectedDate === demoDate ? 'Agenda de hoy' : `Agenda del ${formatLongDate(activeDate)}`

  return (
    <section className={`agenda-panel ${expanded ? 'agenda-panel-expanded' : ''}`}>
      <div className="agenda-header">
        <div><p className="eyebrow">VISTA DIARIA</p><h2>{dateLabel}</h2></div>
        <div className="agenda-date-control"><button type="button" aria-label="Día anterior" className="icon-button subtle-icon" onClick={() => onShiftDate(-1)}><ChevronLeft size={17} /></button><span>{formatLongDate(activeDate)}</span><button type="button" aria-label="Día siguiente" className="icon-button subtle-icon" onClick={() => onShiftDate(1)}><ChevronRight size={17} /></button></div>
      </div>
      <div className="filter-row" role="group" aria-label="Filtrar citas">
        {filters.map((item) => <button key={item} type="button" className={`filter-chip ${filter === item ? 'filter-chip-active' : ''}`} onClick={() => onFilterChange(item)}>{item}{item === 'Por confirmar' && <span>{pendingCount}</span>}</button>)}
      </div>
      <div className="appointments-list">
        {appointments.length === 0 ? <div className="empty-state"><CalendarDays size={23} /><strong>No hay citas en este filtro</strong><span>Prueba otra opción o crea una cita nueva.</span></div> : appointments.map((appointment) => <AppointmentRow key={appointment.id} appointment={appointment} />)}
      </div>
      <button className="agenda-footer-link" type="button" onClick={onNewAppointment}>Añadir cita <Plus size={15} /></button>
    </section>
  )
}

function AppointmentRow({ appointment }: { appointment: Appointment }) {
  const statusClass = appointment.status === 'Completada' ? 'status-complete' : appointment.status === 'Por confirmar' ? 'status-pending' : 'status-confirmed'
  return (
    <article className="appointment-row">
      <div className="appointment-time"><strong>{appointment.time}</strong><span>{appointment.duration}</span></div>
      <div className={`client-avatar avatar-${appointment.color}`}>{appointment.initials}</div>
      <div className="appointment-details"><strong>{appointment.client}</strong><span>{appointment.service}</span></div>
      <span className={`status-pill ${statusClass}`}><i />{appointment.status}</span>
      <span className="appointment-price">{formatCurrency(appointment.price)}</span>
      <button className="icon-button row-more" type="button" aria-label={`Más opciones para ${appointment.client}`}><MoreHorizontal size={18} /></button>
    </article>
  )
}

function AppointmentsTable({ appointments, filter, onFilterChange, onNewAppointment, selectedDate, onShiftDate, pendingCount }: {
  appointments: Appointment[]
  filter: 'Todas' | AppointmentStatus
  onFilterChange: (value: 'Todas' | AppointmentStatus) => void
  onNewAppointment: () => void
  selectedDate: string
  onShiftDate: (offset: number) => void
  pendingCount: number
}) {
  return <AgendaPanel appointments={appointments} filter={filter} onFilterChange={onFilterChange} onNewAppointment={onNewAppointment} selectedDate={selectedDate} onShiftDate={onShiftDate} pendingCount={pendingCount} expanded />
}

function ClientsTable() {
  return (
    <section className="module-panel">
      <div className="module-panel-heading"><div><p className="eyebrow">RELACIONES</p><h2>Clientes frecuentes</h2></div><button className="secondary-button" type="button"><Search size={15} /> Buscar cliente</button></div>
      <div className="data-table-wrap"><table className="data-table"><thead><tr><th>CLIENTE</th><th>WHATSAPP</th><th>VISITAS</th><th>ÚLTIMA CITA</th></tr></thead><tbody>{sampleClients.map((client) => <tr key={client.name}><td><div className="table-person"><div className="client-avatar avatar-rose">{client.name.split(' ').map((part) => part[0]).slice(0, 2).join('')}</div><strong>{client.name}</strong></div></td><td>{client.phone}</td><td>{client.visits}</td><td>{client.lastVisit}</td></tr>)}</tbody></table></div>
    </section>
  )
}

function ServicesTable() {
  return (
    <section className="module-panel">
      <div className="module-panel-heading"><div><p className="eyebrow">CATÁLOGO</p><h2>Servicios activos</h2></div><button className="primary-button" type="button"><Plus size={16} /> Añadir servicio</button></div>
      <div className="data-table-wrap"><table className="data-table"><thead><tr><th>SERVICIO</th><th>DURACIÓN</th><th>PRECIO</th><th>RESERVAS ESTA SEMANA</th></tr></thead><tbody>{sampleServices.map((service) => <tr key={service.name}><td><div className="table-service"><span><Sparkles size={16} /></span><strong>{service.name}</strong></div></td><td>{service.duration}</td><td>{formatCurrency(service.price)}</td><td>{service.bookings}</td></tr>)}</tbody></table></div>
    </section>
  )
}

function HoursOverview() {
  const days = [['Lunes', '09:00', '19:00'], ['Martes', '09:00', '19:00'], ['Miércoles', '09:00', '19:00'], ['Jueves', '09:00', '19:00'], ['Viernes', '09:00', '19:00'], ['Sábado', '09:00', '17:00'], ['Domingo', 'Cerrado', '']]
  return (
    <section className="module-panel hours-panel"><div className="module-panel-heading"><div><p className="eyebrow">DISPONIBILIDAD</p><h2>Horario semanal</h2></div><button className="secondary-button" type="button"><Settings2 size={15} /> Editar horario</button></div><div className="hours-list">{days.map(([day, start, end], index) => <div className="hours-row" key={day}><span className={index === 5 ? 'today-dot' : ''}>{day}</span><strong>{end ? `${start} — ${end}` : start}</strong><span className={end ? 'hours-open' : 'hours-closed'}>{end ? 'Abierto' : 'Cerrado'}</span></div>)}</div></section>
  )
}

function WhatsAppOverview({ onConnect }: { onConnect: () => void }) {
  return (
    <section className="whatsapp-setup"><div className="whatsapp-setup-mark"><MessageCircle size={23} /></div><p className="eyebrow">CANAL DE ATENCIÓN</p><h2>Conecta WhatsApp</h2><p>Vincula el número de tu negocio para gestionar mensajes y confirmar citas desde un solo lugar.</p><button className="primary-button" type="button" onClick={onConnect}>Configurar conexión <ArrowRight size={16} /></button><span className="connection-status"><i /> Sin conectar</span></section>
  )
}

export default App

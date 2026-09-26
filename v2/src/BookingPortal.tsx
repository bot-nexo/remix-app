import {
    ArrowLeft,
    ArrowRight,
    CalendarDays,
    Check,
    CheckCircle2,
    ChevronRight,
    Clock3,
    Flower2,
    MapPin,
    MessageCircle,
    Moon,
    Scissors,
    ShieldCheck,
    Sun,
} from 'lucide-react'
import { useState, type FormEvent } from 'react'
import './BookingPortal.css'

type PortalStep = 'menu' | 'catalog' | 'appointments' | 'service' | 'date' | 'time' | 'details' | 'success'
type CustomerAppointment = {
  id: number
  service: string
  date: string
  time: string
  duration: string
  price: number
  status: 'Confirmada' | 'Cancelada'
}

const portalServices = [
  { name: 'Manicure semipermanente', duration: '60 min', price: 68000, detail: 'Color uniforme y brillo duradero.' },
  { name: 'Nivelación + color', duration: '90 min', price: 110000, detail: 'Refuerzo y acabado a tu medida.' },
  { name: 'Pedicure spa', duration: '75 min', price: 85000, detail: 'Cuidado completo con pausa incluida.' },
  { name: 'Diseño y extensión', duration: '120 min', price: 145000, detail: 'Largo y diseño personalizado.' },
]

const availableTimes = ['09:00', '10:30', '12:00', '14:00', '15:30', '17:00']

const toDateKey = (date: Date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const displayDate = (value: string) => new Intl.DateTimeFormat('es-CO', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
}).format(new Date(`${value}T12:00:00`))

const formatPrice = (amount: number) => new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
}).format(amount)

export default function BookingPortal({
  onBackToAdmin,
  onToggleTheme,
  theme,
}: {
  onBackToAdmin: () => void
  onToggleTheme: () => void
  theme: 'light' | 'dark'
}) {
  const [step, setStep] = useState<PortalStep>('menu')
  const [selectedService, setSelectedService] = useState(portalServices[0])
  const [selectedDate, setSelectedDate] = useState(toDateKey(new Date()))
  const [selectedTime, setSelectedTime] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [appointments, setAppointments] = useState<CustomerAppointment[]>([])
  const [editingAppointmentId, setEditingAppointmentId] = useState<number | null>(null)
  const [notice, setNotice] = useState('')

  function startBooking(service = portalServices[0], appointmentId: number | null = null, chooseService = true) {
    setSelectedService(service)
    setEditingAppointmentId(appointmentId)
    setSelectedTime('')
    setStep(appointmentId ? 'date' : chooseService ? 'service' : 'date')
  }

  function completeBooking(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextAppointment: CustomerAppointment = {
      id: editingAppointmentId ?? Date.now(),
      service: selectedService.name,
      date: selectedDate,
      time: selectedTime,
      duration: selectedService.duration,
      price: selectedService.price,
      status: 'Confirmada',
    }

    setAppointments((current) => editingAppointmentId
      ? current.map((appointment) => appointment.id === editingAppointmentId ? nextAppointment : appointment)
      : [...current, nextAppointment],
    )
    setEditingAppointmentId(null)
    setStep('success')
  }

  function saveReschedule() {
    if (!editingAppointmentId) return
    setAppointments((current) => current.map((appointment) => appointment.id === editingAppointmentId
      ? {
          ...appointment,
          service: selectedService.name,
          date: selectedDate,
          time: selectedTime,
          duration: selectedService.duration,
          price: selectedService.price,
          status: 'Confirmada',
        }
      : appointment,
    ))
    setEditingAppointmentId(null)
    setStep('success')
  }

  function cancelAppointment(appointmentId: number) {
    setAppointments((current) => current.map((appointment) => appointment.id === appointmentId
      ? { ...appointment, status: 'Cancelada' }
      : appointment,
    ))
    setNotice('La cita quedó cancelada en esta vista de muestra.')
    window.setTimeout(() => setNotice(''), 3500)
  }

  function returnToMenu() {
    setStep('menu')
    setEditingAppointmentId(null)
  }

  const today = toDateKey(new Date())
  const service = selectedService

  return (
    <div className={`booking-portal theme-${theme}`}>
      <header className="portal-topbar">
        <button className="portal-brand" type="button" onClick={returnToMenu} aria-label="Ir al inicio de reservas">
          <span className="portal-brand-mark"><Flower2 size={20} /></span>
          <span><strong>Angel Nails</strong><small>RESERVAS</small></span>
        </button>
        <div className="portal-header-actions">
          <button className="portal-theme-toggle" type="button" onClick={onToggleTheme} aria-label={`Cambiar a tema ${theme === 'light' ? 'oscuro' : 'claro'}`} title={`Cambiar a tema ${theme === 'light' ? 'oscuro' : 'claro'}`}>{theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}</button>
          <button className="portal-exit" type="button" onClick={onBackToAdmin} aria-label="Volver al panel" title="Volver al panel"><span>Panel de muestra</span><ArrowRight size={14} /></button>
        </div>
      </header>

      <main className="portal-content">
        {step === 'menu' && (
          <>
            <section className="portal-welcome">
              <div className="welcome-copy"><span className="portal-kicker">UN MOMENTO PARA TI</span><h1>Tu próxima cita,<br />a tu ritmo.</h1><p>Elige cómo quieres continuar y te acompañamos con el resto.</p></div>
              <div className="welcome-art" aria-hidden="true"><div className="welcome-orbit"><Flower2 size={54} strokeWidth={1.2} /></div><span className="welcome-spark spark-one">✳</span><span className="welcome-spark spark-two">✦</span></div>
            </section>
            <section className="portal-actions" aria-label="Opciones de reserva">
              <button className="portal-action-primary" type="button" onClick={() => startBooking()}>
                <span className="portal-action-icon"><CalendarDays size={21} /></span><span className="portal-action-copy"><strong>Agendar una cita</strong><small>Encuentra un horario que te quede bien</small></span><ArrowRight size={19} />
              </button>
              <button className="portal-action" type="button" onClick={() => setStep('catalog')}><span className="portal-action-icon"><Scissors size={19} /></span><span className="portal-action-copy"><strong>Servicios y precios</strong><small>Conoce los tratamientos disponibles</small></span><ChevronRight size={17} /></button>
              <button className="portal-action" type="button" onClick={() => setStep('appointments')}><span className="portal-action-icon"><CalendarDays size={19} /></span><span className="portal-action-copy"><strong>Mis citas</strong><small>Consulta, cambia o cancela una reserva</small></span><ChevronRight size={17} /></button>
              <div className="portal-contact-row"><div><MapPin size={16} /><span>Angel Nails · Bogotá</span></div><button type="button" onClick={() => setNotice('La atención por WhatsApp estará disponible al conectar el servicio.') }><MessageCircle size={15} /> Necesito ayuda</button></div>
            </section>
            <p className="portal-privacy"><ShieldCheck size={14} /> Tus datos se usan únicamente para gestionar tus citas.</p>
          </>
        )}

        {step === 'catalog' && (
          <section className="portal-flow">
            <PortalBack onClick={returnToMenu} />
            <div className="portal-section-title"><span className="portal-kicker">CARTA DE SERVICIOS</span><h1>Elige cómo<br />quieres cuidarte.</h1><p>Todos los precios están expresados en pesos colombianos.</p></div>
              <div className="portal-service-list">{portalServices.map((item) => <article className="portal-service" key={item.name}><div><h2>{item.name}</h2><p>{item.detail}</p><span><Clock3 size={13} /> {item.duration}</span></div><div className="portal-service-side"><strong>{formatPrice(item.price)}</strong><button type="button" onClick={() => startBooking(item, null, false)}>Elegir</button></div></article>)}</div>
          </section>
        )}

        {step === 'appointments' && (
          <section className="portal-flow">
            <PortalBack onClick={returnToMenu} />
            <div className="portal-section-title"><span className="portal-kicker">TU HISTORIAL</span><h1>Mis citas</h1><p>Gestiona tus próximas visitas a Angel Nails.</p></div>
            {appointments.length === 0 ? <div className="portal-empty"><CalendarDays size={25} /><strong>Aún no tienes citas</strong><span>Cuando reserves, aparecerán aquí para que puedas gestionarlas.</span><button type="button" onClick={() => startBooking()}>Agendar una cita</button></div> : <div className="portal-service-list">{appointments.map((appointment) => <article className="portal-service appointment-card" key={appointment.id}><div><span className={`portal-status ${appointment.status === 'Confirmada' ? 'portal-status-active' : 'portal-status-cancelled'}`}>{appointment.status}</span><h2>{appointment.service}</h2><p>{displayDate(appointment.date)} · {appointment.time}</p><span><Clock3 size={13} /> {appointment.duration}</span></div><div className="portal-service-side"><strong>{formatPrice(appointment.price)}</strong>{appointment.status === 'Confirmada' && <><button type="button" onClick={() => { const matchingService = portalServices.find((item) => item.name === appointment.service) ?? portalServices[0]; setSelectedDate(appointment.date); startBooking(matchingService, appointment.id) }}>Reagendar</button><button className="portal-cancel-link" type="button" onClick={() => cancelAppointment(appointment.id)}>Cancelar</button></>}</div></article>)}</div>}
          </section>
        )}

        {step === 'service' && (
          <section className="portal-flow">
            <PortalBack onClick={returnToMenu} />
            <StepIndicator step={1} />
            <div className="portal-section-title"><span className="portal-kicker">PASO 1 DE 4</span><h1>Elige tu<br />servicio.</h1><p>¿Qué te gustaría hacer hoy?</p></div>
            <div className="portal-service-list">{portalServices.map((item) => <button className={`portal-service-choice ${service.name === item.name ? 'portal-service-selected' : ''}`} type="button" key={item.name} onClick={() => setSelectedService(item)}><span className="choice-check">{service.name === item.name && <Check size={14} />}</span><span className="choice-main"><strong>{item.name}</strong><small>{item.duration}</small></span><strong className="choice-price">{formatPrice(item.price)}</strong></button>)}</div>
            <button className="portal-continue" type="button" onClick={() => setStep('date')}>Continuar <ArrowRight size={17} /></button>
          </section>
        )}

        {step === 'date' && (
          <section className="portal-flow">
            <PortalBack onClick={() => setStep(editingAppointmentId ? 'appointments' : 'service')} />
            <StepIndicator step={2} />
            <div className="portal-section-title"><span className="portal-kicker">PASO 2 DE 4</span><h1>¿Qué día<br />te funciona?</h1><p>{service.name} · {service.duration}</p></div>
            <label className="portal-field">Fecha de la cita<input type="date" min={today} value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} /></label>
            <button className="portal-continue" type="button" disabled={!selectedDate} onClick={() => setStep('time')}>Ver horarios <ArrowRight size={17} /></button>
          </section>
        )}

        {step === 'time' && (
          <section className="portal-flow">
            <PortalBack onClick={() => setStep('date')} />
            <StepIndicator step={3} />
            <div className="portal-section-title"><span className="portal-kicker">PASO 3 DE 4</span><h1>Escoge tu<br />horario.</h1><p>{displayDate(selectedDate)} · {service.name}</p></div>
            <div className="portal-time-grid">{availableTimes.map((time) => <button className={`portal-time ${selectedTime === time ? 'portal-time-selected' : ''}`} key={time} type="button" onClick={() => setSelectedTime(time)}>{time}</button>)}</div>
            <button className="portal-continue" type="button" disabled={!selectedTime} onClick={() => editingAppointmentId ? saveReschedule() : setStep('details')}>{editingAppointmentId ? 'Guardar nuevo horario' : 'Continuar'} <ArrowRight size={17} /></button>
          </section>
        )}

        {step === 'details' && (
          <section className="portal-flow">
            <PortalBack onClick={() => setStep('time')} />
            <StepIndicator step={4} />
            <div className="portal-section-title"><span className="portal-kicker">PASO 4 DE 4</span><h1>¿A nombre<br />de quién?</h1><p>Te enviaremos los detalles de la reserva a tu WhatsApp.</p></div>
            <form className="portal-details-form" onSubmit={completeBooking}>
              <label className="portal-field">Nombre completo<input required value={customerName} onChange={(event) => setCustomerName(event.target.value)} autoComplete="name" placeholder="Tu nombre" /></label>
              <label className="portal-field">WhatsApp<input required type="tel" value={customerPhone} onChange={(event) => setCustomerPhone(event.target.value)} autoComplete="tel" placeholder="+57 300 000 0000" /></label>
              <div className="portal-summary"><span>{service.name}</span><span>{displayDate(selectedDate)} · {selectedTime}</span><strong>{formatPrice(service.price)}</strong></div>
              <button className="portal-continue" type="submit">Confirmar cita <Check size={17} /></button>
            </form>
          </section>
        )}

        {step === 'success' && (
          <section className="portal-success"><div className="success-check"><CheckCircle2 size={35} /></div><span className="portal-kicker">RESERVA LISTA</span><h1>Tu momento<br />ya está agendado.</h1><p>{displayDate(selectedDate)} a las {selectedTime}</p><div className="success-details"><span>{service.name}</span><strong>{formatPrice(service.price)}</strong></div><button className="portal-continue" type="button" onClick={() => setStep('appointments')}>Ver mis citas <ArrowRight size={17} /></button><button className="portal-text-button" type="button" onClick={returnToMenu}>Volver al inicio</button></section>
        )}
      </main>

      <footer className="portal-footer"><span>Angel Nails · Bogotá</span><span>Vista de demostración</span></footer>
      {notice && <div className="portal-notice" role="status">{notice}</div>}
    </div>
  )
}

function PortalBack({ onClick }: { onClick: () => void }) {
  return <button className="portal-back" type="button" onClick={onClick}><ArrowLeft size={16} /> Volver</button>
}

function StepIndicator({ step }: { step: number }) {
  return <div className="step-indicator" aria-label={`Paso ${step} de 4`}>{[1, 2, 3, 4].map((number) => <span className={number <= step ? 'step-active' : ''} key={number} />)}</div>
}

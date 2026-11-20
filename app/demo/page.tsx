'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ArrowLeft, ArrowUpRight, CalendarDays, Check, Clock3, Plus, Trash2 } from 'lucide-react';

type Sector = 'barber' | 'beauty' | 'technical';
type DemoAppointment = { id: number; day: string; time: string; customer: string; service: string; status: 'Confirmada' | 'Pendiente' };

const examples: Record<Sector, { name: string; sector: string; services: string[]; appointments: DemoAppointment[] }> = {
  barber: {
    name: 'Estudio Central', sector: 'Barbería',
    services: ['Corte clásico · 30 min', 'Corte + barba · 45 min', 'Perfilado · 30 min'],
    appointments: [
      { id: 1, day: 'Hoy', time: '09:30', customer: 'Matías González', service: 'Corte clásico', status: 'Confirmada' },
      { id: 2, day: 'Hoy', time: '10:30', customer: 'Camila Rojas', service: 'Corte + barba', status: 'Confirmada' },
      { id: 3, day: 'Hoy', time: '12:00', customer: 'Javiera Soto', service: 'Perfilado', status: 'Pendiente' },
      { id: 4, day: 'Mañana', time: '11:00', customer: 'Tomás Pérez', service: 'Corte clásico', status: 'Confirmada' },
    ],
  },
  beauty: {
    name: 'Espacio Serena', sector: 'Belleza y estética',
    services: ['Limpieza facial · 60 min', 'Manicure · 45 min', 'Perfilado de cejas · 30 min'],
    appointments: [
      { id: 1, day: 'Hoy', time: '10:00', customer: 'Antonia Silva', service: 'Limpieza facial', status: 'Confirmada' },
      { id: 2, day: 'Hoy', time: '11:30', customer: 'Camila Rojas', service: 'Manicure', status: 'Pendiente' },
      { id: 3, day: 'Mañana', time: '14:00', customer: 'Javiera Soto', service: 'Perfilado de cejas', status: 'Confirmada' },
    ],
  },
  technical: {
    name: 'Servicio Técnico Norte', sector: 'Servicios técnicos',
    services: ['Diagnóstico · 30 min', 'Mantención · 60 min', 'Visita técnica · 90 min'],
    appointments: [
      { id: 1, day: 'Hoy', time: '09:00', customer: 'Felipe Muñoz', service: 'Diagnóstico', status: 'Confirmada' },
      { id: 2, day: 'Hoy', time: '11:00', customer: 'Daniela Pérez', service: 'Mantención', status: 'Pendiente' },
      { id: 3, day: 'Mañana', time: '15:00', customer: 'Jorge Soto', service: 'Visita técnica', status: 'Confirmada' },
    ],
  },
};

export default function DemoPage() {
  const [sector, setSector] = useState<Sector>('barber');
  const [day, setDay] = useState('Hoy');
  const [appointments, setAppointments] = useState<DemoAppointment[]>(examples.barber.appointments);
  const [showForm, setShowForm] = useState(false);
  const [customer, setCustomer] = useState('');
  const [time, setTime] = useState('13:00');
  const [service, setService] = useState('Corte clásico');
  const current = examples[sector];
  const visible = useMemo(() => appointments.filter((a) => a.day === day).sort((a, b) => a.time.localeCompare(b.time)), [appointments, day]);
  const changeSector = (value: Sector) => { setSector(value); setAppointments(examples[value].appointments); setDay('Hoy'); setService(examples[value].services[0].split(' · ')[0]); setShowForm(false); };
  const addAppointment = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!customer.trim()) return;
    setAppointments((items) => [...items, { id: Date.now(), day, time, customer: customer.trim(), service, status: 'Pendiente' }]);
    setCustomer(''); setShowForm(false);
  };
  const toggleStatus = (id: number) => setAppointments((items) => items.map((item) => item.id === id ? { ...item, status: item.status === 'Pendiente' ? 'Confirmada' : 'Pendiente' } : item));
  const removeAppointment = (id: number) => setAppointments((items) => items.filter((item) => item.id !== id));

  return <main className="min-h-screen bg-[#F5F7F4] px-5 py-8 md:py-12">
    <div className="mx-auto max-w-[1050px]">
      <Link href="/" className="mb-8 inline-flex items-center gap-2 text-xs font-semibold text-[#397D78]"><ArrowLeft size={14}/> Volver al inicio</Link>
      <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
        <div className="max-w-2xl"><div className="eyebrow">Demo interactiva · datos de ejemplo</div><h1 className="mt-3 text-[38px] font-semibold leading-tight tracking-[-.05em] md:text-[50px]">Prueba cómo se organiza tu agenda.</h1><p className="mt-4 text-sm leading-6 text-[#718087]">Cambia de rubro, revisa las horas, agrega una reserva ficticia y confirma o elimina citas. Todo ocurre en esta demostración, sin crear datos reales.</p></div>
        <Link href="/registro" className="btn-primary shrink-0">Comenzar demo por 7 días <ArrowUpRight size={14}/></Link>
      </div>

      <section className="panel mt-8 overflow-hidden">
        <div className="flex flex-col gap-4 border-b border-[#E2E9E5] bg-white p-5 md:flex-row md:items-center md:justify-between md:px-7">
          <div><div className="text-[16px] font-semibold text-[#172B3A]">{current.name}</div><div className="mt-1 text-[10px] text-[#718087]">{current.sector} · Espacio de demostración</div></div>
          <label className="text-[10px] font-semibold text-[#718087]">Explorar rubro<select className="field mt-1 min-w-[210px]" value={sector} onChange={(e) => changeSector(e.target.value as Sector)}><option value="barber">Barbería</option><option value="beauty">Belleza y estética</option><option value="technical">Servicios técnicos</option></select></label>
        </div>
        <div className="grid gap-6 p-5 md:grid-cols-[.75fr_1.5fr] md:p-7">
          <aside>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-[#F5F7F4] p-4"><div className="text-[25px] font-semibold text-[#172B3A]">{appointments.length}</div><div className="mt-1 text-[10px] text-[#718087]">Reservas de ejemplo</div></div>
              <div className="rounded-2xl bg-[#DCEBE6] p-4"><div className="text-[25px] font-semibold text-[#397D78]">{appointments.filter((a) => a.status === 'Pendiente').length}</div><div className="mt-1 text-[10px] text-[#4E6C6A]">Por confirmar</div></div>
            </div>
            <div className="mt-6"><div className="mb-3 text-[11px] font-semibold text-[#172B3A]">Servicios del negocio</div><div className="space-y-2">{current.services.map((item) => <div key={item} className="rounded-xl border border-[#E2E9E5] bg-white px-3 py-3 text-[11px] text-[#53636A]">{item}</div>)}</div></div>
            <div className="mt-5 rounded-xl bg-[#F5F7F4] p-4"><div className="flex items-center gap-2 text-[11px] font-semibold text-[#172B3A]"><Clock3 size={14} className="text-[#397D78]"/> Horario de atención</div><p className="mt-2 text-[10px] leading-5 text-[#718087]">Lunes a viernes · 09:00 a 18:00<br/>Sábado · 10:00 a 14:00</p></div>
          </aside>
          <div>
            <div className="flex flex-wrap items-center justify-between gap-3"><div><div className="text-[14px] font-semibold text-[#172B3A]">Agenda de reservas</div><div className="mt-1 text-[10px] text-[#718087]">Selecciona un día y administra las citas.</div></div><button onClick={() => setShowForm((v) => !v)} className="btn-primary"><Plus size={14}/>{showForm ? 'Cerrar' : 'Agregar reserva'}</button></div>
            <div className="mt-5 flex gap-2"><button onClick={() => setDay('Hoy')} className={`rounded-xl px-4 py-2 text-[11px] font-semibold ${day === 'Hoy' ? 'bg-[#172B3A] text-white' : 'border border-[#E2E9E5] bg-white text-[#53636A]'}`}>Hoy</button><button onClick={() => setDay('Mañana')} className={`rounded-xl px-4 py-2 text-[11px] font-semibold ${day === 'Mañana' ? 'bg-[#172B3A] text-white' : 'border border-[#E2E9E5] bg-white text-[#53636A]'}`}>Mañana</button></div>
            {showForm && <form onSubmit={addAppointment} className="mt-4 grid gap-3 rounded-2xl border border-[#C8DDD6] bg-[#F8FBF9] p-4 sm:grid-cols-2"><label className="text-[10px] font-semibold text-[#53636A]">Nombre del cliente<input required className="field mt-1" value={customer} onChange={(e) => setCustomer(e.target.value)} placeholder="Ej. Paula González"/></label><label className="text-[10px] font-semibold text-[#53636A]">Servicio<select className="field mt-1" value={service} onChange={(e) => setService(e.target.value.split(' · ')[0])}>{current.services.map((s) => <option key={s} value={s.split(' · ')[0]}>{s}</option>)}</select></label><label className="text-[10px] font-semibold text-[#53636A]">Hora<input required type="time" className="field mt-1" value={time} onChange={(e) => setTime(e.target.value)}/></label><div className="flex items-end"><button className="btn-primary w-full" type="submit">Guardar reserva ficticia <Check size={14}/></button></div></form>}
            <div className="mt-4 space-y-2">{visible.length ? visible.map((a) => <article key={a.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-[#E2E9E5] bg-white p-3"><div className="min-w-[48px] text-[12px] font-semibold tabular-nums text-[#172B3A]">{a.time}</div><div className="h-8 w-px bg-[#397D78]"/><div className="min-w-0 flex-1"><div className="text-[11px] font-semibold text-[#172B3A]">{a.customer}</div><div className="mt-1 text-[10px] text-[#718087]">{a.service}</div></div><button onClick={() => toggleStatus(a.id)} className={`rounded-full px-2.5 py-1 text-[9px] font-semibold ${a.status === 'Confirmada' ? 'bg-[#DCEBE6] text-[#397D78]' : 'bg-[#FFF2D9] text-[#946C2C]'}`}>{a.status}</button><button aria-label="Eliminar reserva de ejemplo" title="Eliminar" onClick={() => removeAppointment(a.id)} className="rounded-lg p-2 text-[#9AA4A3] hover:bg-[#F5F7F4] hover:text-[#9c5147]"><Trash2 size={14}/></button></article>) : <div className="rounded-xl border border-dashed border-[#C8D7D1] p-8 text-center text-[11px] text-[#718087]">No hay reservas para este día. Puedes agregar una de ejemplo.</div>}</div>
          </div>
        </div>
      </section>
      <div className="mt-6 flex flex-col items-start justify-between gap-4 rounded-2xl bg-[#DCEBE6] p-6 sm:flex-row sm:items-center"><div><div className="text-sm font-semibold text-[#172B3A]">¿Listo para configurar tu propio negocio?</div><p className="mt-1 text-xs text-[#4E6C6A]">Crea tu cuenta y comienza tu demo de 7 días.</p></div><Link href="/registro" className="btn-primary">Comenzar demo por 7 días <ArrowUpRight size={14}/></Link></div>
    </div>
  </main>;
}

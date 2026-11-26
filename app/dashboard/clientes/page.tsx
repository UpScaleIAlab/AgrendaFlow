'use client';

import { AppShell } from '@/components/app-shell';
import { useAgenda } from '@/components/agenda-provider';
import { MessageCircle, Users, CalendarDays } from 'lucide-react';

export default function CustomersPage() {
  const { data } = useAgenda();

  const customers = Array.from(
    data.appointments.reduce((map, appointment) => {
      const key = appointment.phone.replace(/\D/g, '');
      const previous = map.get(key);
      if (!previous) {
        map.set(key, {
          name: appointment.customer,
          phone: appointment.phone,
          rut: appointment.customerRut||'',
          count: 1,
          lastDate: appointment.date,
          appointments: [appointment],
        });
      } else {
        previous.count += 1;
        previous.appointments.push(appointment);
        if (appointment.date > previous.lastDate) {
          previous.lastDate = appointment.date;
          previous.name = appointment.customer;
          if(appointment.customerRut)previous.rut=appointment.customerRut;
        }
      }
      return map;
    }, new Map<string, { name: string; phone: string; rut:string; count: number; lastDate: string; appointments: typeof data.appointments }>())
      .values(),
  ).sort((a, b) => b.lastDate.localeCompare(a.lastDate));

  const serviceName = (serviceId: string) =>
    data.services.find((service) => service.id === serviceId)?.name || 'Servicio no disponible';

  const appointmentStatus = (status: string) =>
    status === 'cancelled' ? 'Cancelada'
      : status === 'completed' ? 'Completada'
      : status === 'confirmed' ? 'Confirmada'
      : 'Pendiente';

  const reminderLink = (customer: typeof customers[number]) => {
    const nextAppointment = customer.appointments
      .filter((appointment) => appointment.status === 'confirmed')
      .filter((appointment) => new Date(`${appointment.date}T${appointment.time}:00`).getTime() > Date.now())
      .sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`))[0];

    if (!nextAppointment) return null;

    const dateParts = nextAppointment.date.split('-');
    const readableDate = dateParts.length === 3
      ? `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}`
      : nextAppointment.date;
    const message = encodeURIComponent(
      `Hola ${customer.name}, te recordamos tu reserva en ${data.businessName}. Servicio: ${serviceName(nextAppointment.serviceId)}, el día ${readableDate} a las ${nextAppointment.time}. ¡Te esperamos!`
    );
    return `https://wa.me/${customer.phone.replace(/\D/g, '')}?text=${message}`;
  };

  return (
    <AppShell>
      <div className="mb-8">
        <div className="eyebrow">Personas que atiendes</div>
        <h1 className="mt-2 text-2xl font-semibold tracking-[-.045em] sm:text-[32px]">Mis clientes</h1>
        <p className="mt-2 text-[13px] text-[#718087]">Datos básicos e historial de sus reservas.</p>
      </div>

      <div className="mb-5 grid gap-3 sm:grid-cols-2">
        <div className="panel flex items-center gap-3 p-3 sm:gap-4 sm:p-4">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#DCEBE6] text-[#397D78]"><Users size={18} /></div>
          <div><div className="text-[23px] font-semibold">{customers.length}</div><div className="text-[10px] text-[#718087]">Clientes registrados</div></div>
        </div>
        <div className="panel flex items-center gap-4 p-4">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#DCEBE6] text-[#68805e]"><CalendarDays size={18} /></div>
          <div><div className="text-[23px] font-semibold">{data.appointments.length}</div><div className="text-[10px] text-[#718087]">Reservas registradas</div></div>
        </div>
      </div>

      <section className="panel overflow-hidden">
        <div className="border-b border-[#E2E9E5] px-3 py-4 sm:px-5"><h2 className="text-[13px] font-semibold">Historial de clientes</h2></div>
        {customers.length ? customers.map((customer) => {
          const link = reminderLink(customer);
          return (
            <div key={customer.phone} className="grid min-w-0 gap-3 border-b border-[#E2E9E5] px-3 py-4 last:border-0 sm:grid-cols-[1fr_auto] sm:items-center sm:px-5 sm:py-5">
              <div>
                <div className="text-[13px] font-semibold">{customer.name}</div>
                <div className="mt-1 text-[10px] text-[#718087]">{customer.phone}{data.sector==='health'&&customer.rut?` · RUT: ${customer.rut}`:''} · {customer.count} {customer.count === 1 ? 'reserva' : 'reservas'} · Última visita: {customer.lastDate}</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {customer.appointments
                    .sort((a, b) => `${b.date}T${b.time}`.localeCompare(`${a.date}T${a.time}`))
                    .slice(0, 6)
                    .map((appointment) => (
                      <span key={appointment.id} className="rounded-lg bg-[#f4f1e9] px-2.5 py-2 text-[9px] leading-4 text-[#77766e]">
                        <span className="block font-semibold">{serviceName(appointment.serviceId)}</span>
                        <span>{appointment.date} · {appointment.time} · {appointmentStatus(appointment.status)}{appointment.notes&&<span className="mt-1 block max-w-[360px] whitespace-normal text-[#397D78]">Nota interna: {appointment.notes}</span>}</span>
                      </span>
                    ))}
                </div>
              </div>
              {link ? (
                <a target="_blank" rel="noreferrer" href={link} className="inline-flex items-center justify-center gap-2 rounded-full border border-[#E2E9E5] bg-white px-4 py-2 text-[10px] font-semibold text-[#668064]">
                  <MessageCircle size={13} /> Recordatorio WhatsApp
                </a>
              ) : (
                <span className="text-right text-[10px] text-[#96948b]">Sin reserva confirmada próxima</span>
              )}
            </div>
          );
        }) : (
          <div className="px-6 py-14 text-center">
            <Users className="mx-auto mb-3 text-[#b3a17d]" size={25} />
            <div className="text-[13px] font-semibold">Aún no hay clientes</div>
            <p className="mt-1 text-[11px] text-[#96948b]">Cuando registres reservas, aquí aparecerán sus datos e historial.</p>
          </div>
        )}
      </section>
    </AppShell>
  );
}

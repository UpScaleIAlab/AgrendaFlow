'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { localDate, money } from '@/components/agenda-provider';
import { CalendarDays, CheckCircle2, ArrowLeft } from 'lucide-react';

type PublicService={id:string;name:string;duration:number;price:number};
type PublicHour={weekday:number;enabled:boolean;opens_at:string;closes_at:string};
type BusySlot={starts_at:string;ends_at:string};
type PublicBookingData={business:{name:string;phone:string;slug:string;timezone:string};services:PublicService[];hours:PublicHour[];busy:BusySlot[]};
const mins=(t:string)=>{const [h,m]=t.split(':').map(Number);return h*60+m};
const fmt=(n:number)=>`${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`;

export default function BookingPage(){
 const params=useParams<{slug:string}>();
 const [publicData,setPublicData]=useState<PublicBookingData|null>(null);
 const [loading,setLoading]=useState(true);
 const [serviceId,setServiceId]=useState('');
 const [date,setDate]=useState(localDate(new Date()));
 const [time,setTime]=useState('');
 const [name,setName]=useState('');
 const [phone,setPhone]=useState('');
 const [notes,setNotes]=useState('');
 const [error,setError]=useState('');
 const [done,setDone]=useState(false);
 const [submitting,setSubmitting]=useState(false);
 const service=publicData?.services.find(s=>s.id===serviceId);

 const loadAvailability=useCallback(async()=>{
  if(!params.slug)return;
  const supabase=createClient();
  const {data,error}=await supabase.rpc('get_public_booking_data',{p_slug:params.slug});
  if(error){console.error('No se pudo consultar disponibilidad',error);setError('No pudimos consultar la agenda: '+error.message);setPublicData(null);}
  else if(data)setPublicData(data as PublicBookingData);
  else setPublicData(null);
  setLoading(false);
 },[params.slug]);

 useEffect(()=>{
  const timer=window.setTimeout(()=>{void loadAvailability()},0);
  return()=>window.clearTimeout(timer);
 },[loadAvailability]);
 useEffect(()=>{
  const timer=window.setInterval(()=>void loadAvailability(),10000);
  return()=>window.clearInterval(timer);
 },[loadAvailability]);
 const hours=publicData?.hours.find(h=>h.weekday===new Date(`${date}T12:00:00`).getDay());
 const slots=useMemo(()=>{
  if(!service||!hours?.enabled||!publicData)return[];
  const out:string[]=[];
  const open=mins(hours.opens_at),close=mins(hours.closes_at);
  for(let t=open;t+service.duration<=close;t+=30){
   const startDate=new Date(`${date}T${fmt(t)}:00`);
   const endDate=new Date(startDate.getTime()+service.duration*60000);
   const busy=publicData.busy.some(b=>startDate<new Date(b.ends_at)&&endDate>new Date(b.starts_at));
   const past=startDate<=new Date();
   if(!busy&&!past)out.push(fmt(t));
  }
  return out;
 },[service,hours,publicData,date]);

 const submit=async()=>{
  if(!service||!time||!name.trim()||!phone.trim()){setError('Completa tus datos y selecciona una hora disponible.');return}
  setError('');setSubmitting(true);
  try{
   const startsAt=new Date(`${date}T${time}:00`).toISOString();
   const supabase=createClient();
   const {error:bookingError}=await supabase.rpc('create_public_appointment',{
    p_slug:params.slug,
    p_service_id:service.id,
    p_starts_at:startsAt,
    p_full_name:name.trim(),
    p_phone:phone.trim(),
    p_notes:notes.trim()||null
   });
   if(bookingError){
    await loadAvailability();
    setError(bookingError.message.toLowerCase().includes('ocupado')?'Alguien acaba de reservar esa hora. Selecciona otra disponible.':bookingError.message);
    setTime('');
    return;
   }
   await loadAvailability();
   setDone(true);
  }catch(e){setError(e instanceof Error?e.message:'No se pudo enviar la reserva.');}
  finally{setSubmitting(false)}
 };

 if(loading)return <main className="grid min-h-screen place-items-center bg-[#F5F7F4] text-sm text-[#718087]">Cargando disponibilidad...</main>;
 if(!publicData)return <main className="grid min-h-screen place-items-center bg-[#F5F7F4] p-6"><div className="panel max-w-md p-8 text-center"><CalendarDays className="mx-auto mb-4 text-[#397D78]" size={28}/><h1 className="text-xl font-semibold">Enlace no disponible</h1><p className="mt-2 text-sm text-[#718087]">{error||'No encontramos este negocio o todavía no tiene disponibilidad configurada.'}</p><Link href="/" className="btn-primary mt-5">Ir al inicio</Link></div></main>;

 return <main className="min-h-screen bg-[#F5F7F4] px-4 py-8 md:py-14"><div className="mx-auto max-w-[520px]">
  <div className="mb-7 text-center"><div className="brand-mark mx-auto mb-4"><CalendarDays size={20}/></div><div className="text-[19px] font-semibold tracking-tight">{publicData.business.name}</div><p className="mt-1 text-[11px] text-[#8d8b82]">Reserva tu hora de forma sencilla</p></div>
  <section className="panel overflow-hidden">
   <div className="border-b border-[#E2E9E5] px-6 py-5"><div className="eyebrow">Reservas online</div><h1 className="mt-1 text-[23px] font-semibold tracking-tight">Agenda tu atención</h1><p className="mt-1 text-[11px] text-[#918f86]">Solo mostramos horarios que siguen disponibles.</p></div>
   {done?<div className="px-6 py-12 text-center"><div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-[#DCEBE6] text-[#68805e]"><CheckCircle2 size={27}/></div><h2 className="text-[20px] font-semibold">Solicitud recibida</h2><p className="mx-auto mt-2 max-w-xs text-[12px] leading-5 text-[#718087]">Tu solicitud quedó registrada y está pendiente de confirmación. La persona encargada del negocio se pondrá en contacto contigo.</p><div className="mt-5 rounded-xl bg-[#DCEBE6] p-4 text-left text-[12px]"><div className="font-semibold">{service?.name}</div><div className="mt-1 text-[#718087]">{date} · {time} · {service?money(service.price):''}</div><div className="mt-3 text-[#24514E]">Recibirás la confirmación directamente del negocio.</div></div></div>
   :<div className="space-y-5 px-6 py-6">
    <label className="block text-[11px] font-semibold text-[#6d6b62]">1. Elige un servicio<select className="field mt-1.5" value={serviceId} onChange={e=>{setServiceId(e.target.value);setTime('')}}><option value="">Seleccionar servicio</option>{publicData.services.map(s=><option key={s.id} value={s.id}>{s.name} · {s.duration} min · {money(s.price)}</option>)}</select></label>{publicData.services.length===0&&<p role="alert" className="rounded-xl bg-[#f8eae7] p-3 text-[11px] text-[#9c5147]">Este negocio todavía no tiene servicios activos. Debe agregar uno desde Servicios.</p>}
    <label className="block text-[11px] font-semibold text-[#6d6b62]">2. Selecciona una fecha<input type="date" min={localDate(new Date())} className="field mt-1.5" value={date} onChange={e=>{setDate(e.target.value);setTime('')}}/></label>
    <div><div className="mb-2 text-[11px] font-semibold text-[#6d6b62]">3. Horarios disponibles</div>{!publicData.hours.length?<p className="rounded-xl bg-[#f8eae7] p-3 text-[11px] text-[#9c5147]">Este negocio todavía no configuró sus horarios de atención.</p>:!service?<p className="rounded-xl bg-[#DCEBE6] p-3 text-[11px] text-[#99968d]">Primero selecciona un servicio.</p>:!hours?.enabled?<p className="rounded-xl bg-[#DCEBE6] p-3 text-[11px] text-[#99968d]">El negocio no atiende ese día. Prueba otra fecha.</p>:slots.length?<div className="grid grid-cols-3 gap-2 sm:grid-cols-4">{slots.map(s=><button key={s} onClick={()=>setTime(s)} className={`rounded-xl border px-2 py-3 text-[12px] font-semibold transition ${time===s?'border-[#172B3A] bg-[#172B3A] text-white':'border-[#E2E9E5] bg-white text-[#55564e] hover:border-[#397D78]'}`}>{s}</button>)}</div>:<p className="rounded-xl bg-[#DCEBE6] p-3 text-[11px] text-[#99968d]">No quedan horas disponibles para esta fecha.</p>}</div>
    <div className="border-t border-[#E2E9E5] pt-5"><div className="mb-3 text-[11px] font-semibold text-[#6d6b62]">4. Tus datos</div><div className="space-y-3"><input className="field" value={name} onChange={e=>setName(e.target.value)} placeholder="Nombre y apellido"/><input type="tel" inputMode="tel" autoComplete="tel" className="field" value={phone} onChange={e=>setPhone(e.target.value)} placeholder="+56912345678" aria-label="Teléfono con código de país"/><p className="text-[10px] leading-5 text-[#718087]">Ingresa tu número con código de país. Ejemplo Chile: +56912345678.</p><textarea className="field" rows={2} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Notas (opcional)"/></div></div>
    {error&&<p className="text-[11px] text-[#a45f52]">{error}</p>}
    <button disabled={submitting} onClick={submit} className="btn-primary w-full py-3.5 disabled:opacity-60">{submitting?'Guardando...':'Solicitar hora'} <ArrowLeft className="rotate-180" size={14}/></button>
    <button onClick={()=>void loadAvailability()} className="w-full text-center text-[10px] text-[#718087] underline">Actualizar horarios disponibles</button>
    <p className="text-center text-[10px] text-[#a09d94]">Tu reserva quedará pendiente hasta que el negocio la confirme.</p>
   </div>}
  </section><p className="mt-5 text-center text-[10px] text-[#a09d94]">FlowAgenda by FM Digital · Reservas simples</p>
 </div></main>
}

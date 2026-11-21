'use client';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { initialData } from '@/lib/initial-data';
import { createClient } from '@/lib/supabase/client';
import type { AgendaData, Appointment, Service, WorkingDay, BlockedTime } from '@/lib/types';

type ContextValue = { data: AgendaData; ready: boolean; addAppointment:(a:Omit<Appointment,'id'>)=>Promise<{ok:boolean;message?:string}>; updateAppointment:(id:string, patch:Partial<Appointment>)=>Promise<{ok:boolean;message?:string}>; deleteAppointment:(id:string)=>void; saveService:(s:Service)=>Promise<{ok:boolean;message?:string}>; deleteService:(id:string)=>void; saveHours:(h:WorkingDay[])=>Promise<{ok:boolean;message?:string}>; addBlocked:(b:Omit<BlockedTime,'id'>)=>Promise<{ok:boolean;message?:string}>; removeBlocked:(id:string)=>void; updateBusiness:(patch:Partial<Pick<AgendaData,'businessName'|'phone'|'slug'>>)=>Promise<{ok:boolean;message?:string}> };
const Ctx = createContext<ContextValue | null>(null);

type ServiceRow={id:string;name:string;duration_minutes:number;price_clp:number;active:boolean};
type HoursRow={weekday:number;enabled:boolean;opens_at:string;closes_at:string};
type AppointmentRow={id:string;starts_at:string;service_id:string|null;notes:string|null;status:Appointment['status'];customers:{full_name:string;phone:string}|null};
type BlockedRow={id:string;starts_at:string;ends_at:string;reason:string};
const dayNames=['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
const toIso=(date:string,time:string)=>new Date(`${date}T${time}:00`).toISOString();
const fromIso=(value:string)=>{const d=new Date(value);return {date:`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`,time:`${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`}};
export function AgendaProvider({children}:{children:React.ReactNode}) {
 const [data,setData]=useState<AgendaData>(initialData);
 const [ready,setReady]=useState(false);
 const [businessId,setBusinessId]=useState<string|null>(null);

 useEffect(()=>{
  let active=true;
  const load=async()=>{
   try{
    const supabase=createClient();
    const {data:{user}}=await supabase.auth.getUser();
    if(!user){if(active)setReady(true);return}
    const {data:foundBusiness,error:businessError}=await supabase.from('businesses').select('id,name,slug,phone').eq('owner_id',user.id).maybeSingle();
    let business=foundBusiness;
    if(businessError)throw businessError;
    if(!business){
      const businessName=String(user.user_metadata?.business_name||'Mi negocio').trim()||'Mi negocio';
      const sector=String(user.user_metadata?.sector||'other');
      const slugBase=businessName.toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'negocio';
      const {data:created,error:createError}=await supabase.from('businesses').upsert({
        owner_id:user.id,name:businessName,slug:`${slugBase}-${user.id.replace(/-/g,'').slice(0,6)}`,
        sector,trial_started_at:new Date().toISOString(),trial_ends_at:new Date(Date.now()+7*24*60*60*1000).toISOString()
      },{onConflict:'owner_id'}).select('id,name,slug,phone').single();
      if(createError)throw createError;
      business=created;
    }
    if(active)setBusinessId(business.id);

    let {data:serviceRows}=await supabase.from('services').select('*').eq('business_id',business.id).order('created_at');
    if(!serviceRows?.length){
      const seed=initialData.services.map(s=>({business_id:business.id,name:s.name,duration_minutes:s.duration,price_clp:s.price,active:s.active}));
      const inserted=await supabase.from('services').insert(seed);
      if(!inserted.error){const q=await supabase.from('services').select('*').eq('business_id',business.id).order('created_at');serviceRows=q.data}
    }
    let {data:hourRows}=await supabase.from('working_hours').select('*').eq('business_id',business.id).order('weekday');
    if(!hourRows?.length){
      const seed=initialData.hours.map(h=>({business_id:business.id,weekday:dayNames.indexOf(h.day.toLowerCase()),opens_at:h.open,closes_at:h.close,enabled:h.enabled}));
      const inserted=await supabase.from('working_hours').insert(seed);
      if(!inserted.error){const q=await supabase.from('working_hours').select('*').eq('business_id',business.id).order('weekday');hourRows=q.data}
    }
    const [{data:appointmentRows},{data:blockedRows}]=await Promise.all([
      supabase.from('appointments').select('*,customers(full_name,phone)').eq('business_id',business.id).order('starts_at'),
      supabase.from('blocked_times').select('*').eq('business_id',business.id).order('starts_at')
    ]);
    const services:Service[]=((serviceRows||[]) as ServiceRow[]).map((s:ServiceRow)=>({id:s.id,name:s.name,duration:s.duration_minutes,price:s.price_clp,active:s.active}));
    const hours:WorkingDay[]=((hourRows||[]) as HoursRow[]).map((h:HoursRow)=>({day:['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'][h.weekday],enabled:h.enabled,open:String(h.opens_at).slice(0,5),close:String(h.closes_at).slice(0,5)}));
    const appointments:Appointment[]=((appointmentRows||[]) as AppointmentRow[]).map((a:AppointmentRow)=>{const slot=fromIso(a.starts_at);return{id:a.id,date:slot.date,time:slot.time,customer:a.customers?.full_name||'Cliente',phone:a.customers?.phone||'',serviceId:a.service_id||'',notes:a.notes||'',status:a.status}});
    const blocked:BlockedTime[]=((blockedRows||[]) as BlockedRow[]).map((b:BlockedRow)=>{const start=fromIso(b.starts_at),end=fromIso(b.ends_at);return{id:b.id,date:start.date,start:start.time,end:end.time,reason:b.reason}});
    if(active){
      setData({businessName:business.name,slug:business.slug,phone:business.phone||'',services,hours,appointments,blocked});
      setReady(true);
    }
   }catch(error){console.error('AgendaFlow: no se pudo cargar la agenda desde Supabase',error);if(active)setReady(true)}
  };
  void load();
  return()=>{active=false};
 },[]);

 useEffect(()=>{
  if(!businessId)return;
  let active=true;
  const refreshAppointments=async()=>{
   const supabase=createClient();
   const {data:rows,error}=await supabase.from('appointments').select('*,customers(full_name,phone)').eq('business_id',businessId).order('starts_at');
   if(error){console.error('No se pudieron actualizar las reservas',error);return}
   if(!active)return;
   const appointments:Appointment[]=((rows||[]) as AppointmentRow[]).map((a:AppointmentRow)=>{const d=new Date(a.starts_at);return{id:a.id,date:`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`,time:`${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`,customer:a.customers?.full_name||'Cliente',phone:a.customers?.phone||'',serviceId:a.service_id||'',notes:a.notes||'',status:a.status}});
   setData(d=>({...d,appointments}));
  };
  const timer=window.setInterval(()=>void refreshAppointments(),12000);
  window.addEventListener('focus',refreshAppointments);
  return()=>{active=false;window.clearInterval(timer);window.removeEventListener('focus',refreshAppointments)};
 },[businessId]);

 const value=useMemo<ContextValue>(()=>({
  data,ready,
  addAppointment:async(a)=>{
   const service=data.services.find(s=>s.id===a.serviceId&&s.active);
   if(!service)return {ok:false,message:'Selecciona un servicio activo.'};
   if(!a.customer.trim()||!a.phone.trim())return {ok:false,message:'Completa nombre y teléfono.'};
   const start=new Date(`${a.date}T${a.time}:00`).getTime();
   if(!Number.isFinite(start)||start<=Date.now())return {ok:false,message:'La reserva debe ser en una fecha y hora futura.'};
   const end=start+service.duration*60000;
   const overlaps=data.appointments.some(x=>{
    if(x.status==='cancelled')return false;
    const xs=new Date(`${x.date}T${x.time}:00`).getTime();
    const xd=data.services.find(s=>s.id===x.serviceId)?.duration||30;
    return start<xs+xd*60000&&end>xs;
   });
   if(overlaps)return {ok:false,message:'Ya existe una reserva que ocupa ese horario. Elige otra hora.'};
   const blocked=data.blocked.some(b=>b.date===a.date&&a.time<b.end&&new Date(`${a.date}T${a.time}:00`).getTime()+service.duration*60000>new Date(`${b.date}T${b.start}:00`).getTime());
   if(blocked)return {ok:false,message:'Ese horario está bloqueado.'};
   if(!businessId)return {ok:false,message:'La agenda todavía se está cargando. Intenta nuevamente.'};
   const supabase=createClient();
   const {data:customer,error:customerError}=await supabase.from('customers').upsert({business_id:businessId,full_name:a.customer.trim(),phone:a.phone.trim()},{onConflict:'business_id,phone'}).select('id').single();
   if(customerError||!customer)return {ok:false,message:customerError?.message||'No se pudo guardar el cliente.'};
   const startsAt=new Date(`${a.date}T${a.time}:00`).toISOString();
   const endsAt=new Date(new Date(startsAt).getTime()+service.duration*60000).toISOString();
   const {data:created,error}=await supabase.from('appointments').insert({business_id:businessId,customer_id:customer.id,service_id:a.serviceId,starts_at:startsAt,ends_at:endsAt,status:a.status,notes:a.notes||null}).select('*,customers(full_name,phone)').single();
   if(error)return {ok:false,message:error.message.includes('Horario ocupado')?'Ese horario acaba de ser reservado. Elige otro.':error.message};
   const d=fromIso(created.starts_at);
   setData(prev=>({...prev,appointments:[...prev.appointments,{...a,id:created.id,date:d.date,time:d.time,customer:created.customers?.full_name||a.customer,phone:created.customers?.phone||a.phone}]}));
   return {ok:true};
  },
  updateAppointment:async(id,patch)=>{
   const current=data.appointments.find(a=>a.id===id);
   if(!current)return {ok:false,message:'No encontramos esa reserva.'};
   const next={...current,...patch};
   if(next.status!=='cancelled'){
    const service=data.services.find(s=>s.id===next.serviceId);
    if(!service)return {ok:false,message:'Selecciona un servicio activo.'};
    const start=new Date(`${next.date}T${next.time}:00`).getTime(),end=start+service.duration*60000;
    if(!Number.isFinite(start)||start<=Date.now())return {ok:false,message:'La reserva debe quedar en una fecha y hora futura.'};
    const conflict=data.appointments.some(x=>{
     if(x.id===id||x.status==='cancelled')return false;
     const xs=new Date(`${x.date}T${x.time}:00`).getTime(),xd=data.services.find(s=>s.id===x.serviceId)?.duration||30;
     return start<xs+xd*60000&&end>xs;
    });
    if(conflict)return {ok:false,message:'Ese horario ya está ocupado por otra reserva.'};
   }
   if(!businessId)return {ok:false,message:'La agenda todavía se está cargando.'};
   const supabase=createClient();
   const {data:customer,error:customerError}=await supabase.from('customers').upsert({business_id:businessId,full_name:next.customer.trim(),phone:next.phone.trim()},{onConflict:'business_id,phone'}).select('id').single();
   if(customerError||!customer)return {ok:false,message:customerError?.message||'No se pudo guardar el cliente.'};
   const service=data.services.find(s=>s.id===next.serviceId);
   const startsAt=new Date(`${next.date}T${next.time}:00`).toISOString();
   const {error}=await supabase.from('appointments').update({customer_id:customer.id,service_id:next.serviceId,starts_at:startsAt,ends_at:new Date(new Date(startsAt).getTime()*(1)+((service?.duration||30)*60000)).toISOString(),status:next.status,notes:next.notes||null}).eq('id',id).eq('business_id',businessId);
   if(error)return {ok:false,message:error.message};
   setData(d=>({...d,appointments:d.appointments.map(a=>a.id===id?next:a)}));
   return {ok:true};
  },
  deleteAppointment:(id)=>{
   if(businessId&&!id.startsWith('local-'))void createClient().from('appointments').delete().eq('id',id).eq('business_id',businessId).then(({error})=>{if(error)console.error(error);else setData(d=>({...d,appointments:d.appointments.filter(a=>a.id!==id)}))});
   else setData(d=>({...d,appointments:d.appointments.filter(a=>a.id!==id)}));
  },
  saveService:async(s)=>{
   if(!businessId)return {ok:false,message:'La agenda todavía se está cargando.'};
   if(!s.name.trim())return {ok:false,message:'El nombre del servicio es obligatorio.'};
   if(!Number.isFinite(s.duration)||s.duration<5||!Number.isFinite(s.price)||s.price<0)return {ok:false,message:'Revisa duración y precio.'};
   const supabase=createClient();
   const payload={business_id:businessId,name:s.name.trim(),duration_minutes:s.duration,price_clp:s.price,active:s.active};
   const query=!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(s.id)
    ?await supabase.from('services').insert(payload).select('*').single()
    :await supabase.from('services').update(payload).eq('id',s.id).eq('business_id',businessId).select('*').single();
   if(query.error||!query.data)return {ok:false,message:query.error?.message||'No se pudo guardar el servicio.'};
   const row=query.data,saved={id:row.id,name:row.name,duration:row.duration_minutes,price:row.price_clp,active:row.active};
   setData(d=>({...d,services:d.services.some(x=>x.id===s.id)?d.services.map(x=>x.id===s.id?saved:x):[...d.services,saved]}));
   return {ok:true};
  },
  deleteService:(id)=>{
   setData(d=>({...d,services:d.services.filter(s=>s.id!==id)}));
   if(businessId)void createClient().from('services').delete().eq('id',id).eq('business_id',businessId).then(({error})=>{if(error)console.error(error)});
  },
  saveHours:async(h)=>{
   if(!businessId)return {ok:false,message:'La agenda todavía se está cargando.'};
   if(h.some(day=>day.enabled&&(!day.open||!day.close||day.open>=day.close)))return {ok:false,message:'En cada día activo, la hora de cierre debe ser posterior a la apertura.'};
   const rows=h.map(day=>({business_id:businessId,weekday:dayNames.indexOf(day.day.toLowerCase()),opens_at:day.open,closes_at:day.close,enabled:day.enabled}));
   const {error}=await createClient().from('working_hours').upsert(rows,{onConflict:'business_id,weekday'});
   if(error)return {ok:false,message:error.message};
   setData(d=>({...d,hours:h}));
   return {ok:true};
  },
  addBlocked:async(b)=>{
   if(!businessId)return {ok:false,message:'La agenda todavía se está cargando.'};
   if(!b.date||b.start>=b.end)return {ok:false,message:'Revisa la fecha y el rango del bloqueo.'};
   const start=new Date(`${b.date}T${b.start}:00`).getTime(),end=new Date(`${b.date}T${b.end}:00`).getTime();
   if(data.appointments.some(a=>a.status!=='cancelled'&&a.date===b.date&&(()=>{
    const as=new Date(`${a.date}T${a.time}:00`).getTime(),duration=data.services.find(s=>s.id===a.serviceId)?.duration||30;
    return start<as+duration*60000&&end>as;
   })()))return {ok:false,message:'Ese bloqueo coincide con una reserva existente.'};
   const {data:row,error}=await createClient().from('blocked_times').insert({business_id:businessId,starts_at:toIso(b.date,b.start),ends_at:toIso(b.date,b.end),reason:b.reason}).select('*').single();
   if(error||!row)return {ok:false,message:error?.message||'No se pudo guardar el bloqueo.'};
   const a=fromIso(row.starts_at),z=fromIso(row.ends_at);
   setData(d=>({...d,blocked:[...d.blocked,{id:row.id,date:a.date,start:a.time,end:z.time,reason:row.reason}]}));
   return {ok:true};
  },
  removeBlocked:(id)=>{
   setData(d=>({...d,blocked:d.blocked.filter(b=>b.id!==id)}));
   if(businessId)void createClient().from('blocked_times').delete().eq('id',id).eq('business_id',businessId).then(({error})=>{if(error)console.error(error)});
  },
  updateBusiness:async(p)=>{
   if(!businessId)return {ok:false,message:'La agenda todavía se está cargando.'};
   const {error}=await createClient().from('businesses').update({name:p.businessName,phone:p.phone}).eq('id',businessId);
   if(error)return {ok:false,message:error.message};
   setData(d=>({...d,...p}));
   return {ok:true};
  }
 }),[data,ready,businessId]);
 return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
export function useAgenda(){const c=useContext(Ctx);if(!c)throw new Error('useAgenda debe usarse dentro de AgendaProvider');return c;}
export const money=(n:number)=>new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP',maximumFractionDigits:0}).format(n);
export const localDate=(d:Date)=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

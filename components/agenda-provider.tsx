'use client';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { initialData } from '@/lib/initial-data';
import { createClient } from '@/lib/supabase/client';
import type { AgendaData, Appointment, Service, WorkingDay, BlockedTime } from '@/lib/types';

type ContextValue = { data: AgendaData; ready: boolean; addAppointment:(a:Omit<Appointment,'id'>)=>{ok:boolean;message?:string}; updateAppointment:(id:string, patch:Partial<Appointment>)=>{ok:boolean;message?:string}; deleteAppointment:(id:string)=>void; saveService:(s:Service)=>void; deleteService:(id:string)=>void; saveHours:(h:WorkingDay[])=>void; addBlocked:(b:Omit<BlockedTime,'id'>)=>void; removeBlocked:(id:string)=>void; updateBusiness:(patch:Partial<Pick<AgendaData,'businessName'|'phone'|'slug'>>)=>void };
const Ctx = createContext<ContextValue | null>(null);
const key='agendaflow-simple-v1';
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
    const {data:business}=await supabase.from('businesses').select('id,name,slug,phone').eq('owner_id',user.id).maybeSingle();
    if(!business){if(active)setReady(true);return}
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
    const services:Service[]=(serviceRows||[]).map((s:any)=>({id:s.id,name:s.name,duration:s.duration_minutes,price:s.price_clp,active:s.active}));
    const hours:WorkingDay[]=(hourRows||[]).map((h:any)=>({day:['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'][h.weekday],enabled:h.enabled,open:String(h.opens_at).slice(0,5),close:String(h.closes_at).slice(0,5)}));
    const appointments:Appointment[]=(appointmentRows||[]).map((a:any)=>{const slot=fromIso(a.starts_at);return{id:a.id,date:slot.date,time:slot.time,customer:a.customers?.full_name||'Cliente',phone:a.customers?.phone||'',serviceId:a.service_id||'',notes:a.notes||'',status:a.status}});
    const blocked:BlockedTime[]=(blockedRows||[]).map((b:any)=>{const start=fromIso(b.starts_at),end=fromIso(b.ends_at);return{id:b.id,date:start.date,start:start.time,end:end.time,reason:b.reason}});
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
   const appointments:Appointment[]=(rows||[]).map((a:any)=>{const d=new Date(a.starts_at);return{id:a.id,date:`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`,time:`${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`,customer:a.customers?.full_name||'Cliente',phone:a.customers?.phone||'',serviceId:a.service_id||'',notes:a.notes||'',status:a.status}});
   setData(d=>({...d,appointments}));
  };
  const timer=window.setInterval(()=>void refreshAppointments(),12000);
  window.addEventListener('focus',refreshAppointments);
  return()=>{active=false;window.clearInterval(timer);window.removeEventListener('focus',refreshAppointments)};
 },[businessId]);

 const value=useMemo<ContextValue>(()=>({
  data,ready,
  addAppointment:(a)=>{
   const service=data.services.find(s=>s.id===a.serviceId);
   if(!service)return {ok:false,message:'Selecciona un servicio.'};
   const optimistic={...a,id:`local-${Date.now()}`};
   setData(d=>({...d,appointments:[...d.appointments,optimistic]}));
   if(businessId){
    void (async()=>{
     const supabase=createClient();
     const {data:customer,error:customerError}=await supabase.from('customers').upsert({business_id:businessId,full_name:a.customer.trim(),phone:a.phone.trim()},{onConflict:'business_id,phone'}).select('id').single();
     if(customerError||!customer){console.error(customerError);setData(d=>({...d,appointments:d.appointments.filter(x=>x.id!==optimistic.id)}));return}
     const start=toIso(a.date,a.time);
     const end=new Date(new Date(start).getTime()+service.duration*60000).toISOString();
     const {data:created,error}=await supabase.from('appointments').insert({business_id:businessId,customer_id:customer.id,service_id:a.serviceId,starts_at:start,ends_at:end,status:a.status,notes:a.notes||null}).select('*,customers(full_name,phone)').single();
     if(error){console.error(error);setData(d=>({...d,appointments:d.appointments.filter(x=>x.id!==optimistic.id)}));return}
     setData(d=>({...d,appointments:d.appointments.map(x=>x.id===optimistic.id?{...a,id:created.id}:x)}));
    })();
   }
   return {ok:true};
  },
  updateAppointment:(id,patch)=>{
   setData(d=>({...d,appointments:d.appointments.map(a=>a.id===id?{...a,...patch}:a)}));
   if(businessId&&patch.status)void createClient().from('appointments').update({status:patch.status}).eq('id',id).eq('business_id',businessId).then(({error})=>{if(error)console.error(error)});
   return {ok:true};
  },
  deleteAppointment:(id)=>{
   setData(d=>({...d,appointments:d.appointments.filter(a=>a.id!==id)}));
   if(businessId)void createClient().from('appointments').delete().eq('id',id).eq('business_id',businessId).then(({error})=>{if(error)console.error(error)});
  },
  saveService:(s)=>{
   if(!businessId)return;
   const supabase=createClient();
   const payload={business_id:businessId,name:s.name,duration_minutes:s.duration,price_clp:s.price,active:s.active};
   void (async()=>{
    const query=!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(s.id)
      ?await supabase.from('services').insert(payload).select('*').single()
      :await supabase.from('services').update(payload).eq('id',s.id).eq('business_id',businessId).select('*').single();
    if(query.error){console.error(query.error);return}
    const row=query.data;const saved={id:row.id,name:row.name,duration:row.duration_minutes,price:row.price_clp,active:row.active};
    setData(d=>({...d,services:d.services.some(x=>x.id===s.id)?d.services.map(x=>x.id===s.id?saved:x):[...d.services,saved]}));
   })();
  },
  deleteService:(id)=>{
   setData(d=>({...d,services:d.services.filter(s=>s.id!==id)}));
   if(businessId)void createClient().from('services').delete().eq('id',id).eq('business_id',businessId).then(({error})=>{if(error)console.error(error)});
  },
  saveHours:(h)=>{
   setData(d=>({...d,hours:h}));
   if(businessId){
    const rows=h.map(day=>({business_id:businessId,weekday:dayNames.indexOf(day.day.toLowerCase()),opens_at:day.open,closes_at:day.close,enabled:day.enabled}));
    void createClient().from('working_hours').upsert(rows,{onConflict:'business_id,weekday'}).then(({error})=>{if(error)console.error(error)});
   }
  },
  addBlocked:(b)=>{
   const local={...b,id:`local-${Date.now()}`};setData(d=>({...d,blocked:[...d.blocked,local]}));
   if(businessId)void createClient().from('blocked_times').insert({business_id:businessId,starts_at:toIso(b.date,b.start),ends_at:toIso(b.date,b.end),reason:b.reason}).select('*').single().then(({data:row,error})=>{if(error){console.error(error);return}if(row){const start=fromIso(row.starts_at),end=fromIso(row.ends_at);setData(d=>({...d,blocked:d.blocked.map(x=>x.id===local.id?{id:row.id,date:start.date,start:start.time,end:end.time,reason:row.reason}:x)}))}});
  },
  removeBlocked:(id)=>{
   setData(d=>({...d,blocked:d.blocked.filter(b=>b.id!==id)}));
   if(businessId)void createClient().from('blocked_times').delete().eq('id',id).eq('business_id',businessId).then(({error})=>{if(error)console.error(error)});
  },
  updateBusiness:(p)=>{
   setData(d=>({...d,...p}));
   if(businessId)void createClient().from('businesses').update({name:p.businessName,phone:p.phone}).eq('id',businessId).then(({error})=>{if(error)console.error(error)});
  }
 }),[data,ready,businessId]);
 return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
export function useAgenda(){const c=useContext(Ctx);if(!c)throw new Error('useAgenda debe usarse dentro de AgendaProvider');return c;}
export const money=(n:number)=>new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP',maximumFractionDigits:0}).format(n);
export const localDate=(d:Date)=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

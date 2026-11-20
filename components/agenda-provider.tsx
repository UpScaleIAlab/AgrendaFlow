'use client';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { initialData } from '@/lib/initial-data';
import type { AgendaData, Appointment, Service, WorkingDay, BlockedTime } from '@/lib/types';

type ContextValue = { data: AgendaData; ready: boolean; addAppointment:(a:Omit<Appointment,'id'>)=>{ok:boolean;message?:string}; updateAppointment:(id:string, patch:Partial<Appointment>)=>{ok:boolean;message?:string}; deleteAppointment:(id:string)=>void; saveService:(s:Service)=>void; deleteService:(id:string)=>void; saveHours:(h:WorkingDay[])=>void; addBlocked:(b:Omit<BlockedTime,'id'>)=>void; removeBlocked:(id:string)=>void; updateBusiness:(patch:Partial<Pick<AgendaData,'businessName'|'phone'|'slug'>>)=>void };
const Ctx = createContext<ContextValue | null>(null);
const key='agendaflow-simple-v1';
const mins=(t:string)=>{const [h,m]=t.split(':').map(Number);return h*60+m};
export function AgendaProvider({children}:{children:React.ReactNode}) {
 const [data,setData]=useState<AgendaData>(initialData); const [ready,setReady]=useState(false);
 useEffect(()=>{try{const raw=localStorage.getItem(key);if(raw)setData(JSON.parse(raw));}catch{}setReady(true)},[]);
 useEffect(()=>{if(ready)localStorage.setItem(key,JSON.stringify(data))},[data,ready]);
 const value=useMemo<ContextValue>(()=>({data,ready,
  addAppointment:(a)=>{const service=data.services.find(s=>s.id===a.serviceId);if(!service)return {ok:false,message:'Selecciona un servicio.'};const start=mins(a.time),end=start+service.duration;const weekday=new Intl.DateTimeFormat('es-CL',{weekday:'long'}).format(new Date(`${a.date}T12:00:00`));const hours=data.hours.find(h=>h.day.toLowerCase()===weekday);if(!hours?.enabled||start<mins(hours.open)||end>mins(hours.close))return {ok:false,message:'La hora está fuera del horario de atención.'};const conflict=data.appointments.some(x=>x.date===a.date&&x.status!=='cancelled'&&(()=>{const s=data.services.find(z=>z.id===x.serviceId);const xs=mins(x.time),xe=xs+(s?.duration||30);return start<xe&&end>xs})());if(conflict)return {ok:false,message:'Ese horario ya está ocupado. Elige otro.'};const block=data.blocked.some(b=>b.date===a.date&&start<mins(b.end)&&end>mins(b.start));if(block)return {ok:false,message:'Ese horario está bloqueado.'};setData(d=>({...d,appointments:[...d.appointments,{...a,id:`AF-${Date.now()}`}]}));return {ok:true};},
  updateAppointment:(id,patch)=>{const current=data.appointments.find(a=>a.id===id);if(!current)return {ok:false,message:'No se encontró la reserva.'};const next={...current,...patch};if(next.status!=='cancelled'){const service=data.services.find(s=>s.id===next.serviceId);if(!service)return {ok:false,message:'Selecciona un servicio.'};const start=mins(next.time),end=start+service.duration;const weekday=new Intl.DateTimeFormat('es-CL',{weekday:'long'}).format(new Date(`${next.date}T12:00:00`));const hours=data.hours.find(h=>h.day.toLowerCase()===weekday);if(!hours?.enabled||start<mins(hours.open)||end>mins(hours.close))return {ok:false,message:'La hora está fuera del horario de atención.'};const conflict=data.appointments.some(x=>x.id!==id&&x.date===next.date&&x.status!=='cancelled'&&(()=>{const s=data.services.find(z=>z.id===x.serviceId);const xs=mins(x.time),xe=xs+(s?.duration||30);return start<xe&&end>xs})());if(conflict)return {ok:false,message:'Ese horario ya está ocupado.'};const block=data.blocked.some(b=>b.date===next.date&&start<mins(b.end)&&end>mins(b.start));if(block)return {ok:false,message:'Ese horario está bloqueado.'};}setData(d=>({...d,appointments:d.appointments.map(a=>a.id===id?next:a)}));return {ok:true};},
  deleteAppointment:(id)=>setData(d=>({...d,appointments:d.appointments.filter(a=>a.id!==id)})),
  saveService:(s)=>setData(d=>({...d,services:d.services.some(x=>x.id===s.id)?d.services.map(x=>x.id===s.id?s:x):[...d.services,s]})),
  deleteService:(id)=>setData(d=>({...d,services:d.services.filter(s=>s.id!==id)})),
  saveHours:(h)=>setData(d=>({...d,hours:h})),
  addBlocked:(b)=>setData(d=>({...d,blocked:[...d.blocked,{...b,id:`BL-${Date.now()}`}]})),
  removeBlocked:(id)=>setData(d=>({...d,blocked:d.blocked.filter(b=>b.id!==id)})),
  updateBusiness:(p)=>setData(d=>({...d,...p}))
 }),[data,ready]);
 return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
export function useAgenda(){const c=useContext(Ctx);if(!c)throw new Error('useAgenda debe usarse dentro de AgendaProvider');return c;}
export const money=(n:number)=>new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP',maximumFractionDigits:0}).format(n);
export const localDate=(d:Date)=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

'use client';
import { createContext, useContext, useEffect, useState } from 'react';

type Language = 'es' | 'en';
const translations: Record<string, string> = {
  'Mi agenda':'My calendar','Servicios':'Services','Horarios':'Hours','Clientes':'Clients',
  'Organización':'Workspace','Espacio de trabajo':'Workspace','Tu espacio de trabajo':'Your workspace',
  'Una agenda clara para que puedas concentrarte en atender.':'A clear calendar so you can focus on your customers.',
  'Cerrar sesión':'Sign out','Cerrando sesión...':'Signing out...','Salir':'Sign out','Saliendo...':'Signing out...',
  'Ver reservas públicas':'View public bookings','Enlace no disponible':'Link unavailable','Cargando agenda...':'Loading calendar...',
  'Cargando tu agenda y datos guardados...':'Loading your calendar and saved data...',
  'No pudimos cargar todos los datos':'We couldn’t load all your data','Reintentar':'Try again',
  'Idioma':'Language','Español':'Spanish','Inglés':'English',
  'Simple desde el primer día':'Simple from day one','Menos tiempo coordinando. Más tiempo atendiendo.':'Less time coordinating. More time serving customers.',
  'Agenda para profesionales, negocios, empresas y equipos. Organiza servicios, horarios y reservas en un solo lugar.':'Scheduling for professionals, businesses and teams. Manage services, hours and bookings in one place.',
  'Agenda organizada':'Organized calendar','Todo a la vista.':'Everything at a glance.','15 días de prueba':'15-day free trial','Conoce el producto.':'Explore the product.',
  'Volver al inicio':'Back to home','Crea tu espacio de trabajo':'Create your workspace','Qué bueno verte de nuevo':'Welcome back',
  'Comienza tu demo de 15 días':'Start your 15-day trial','Iniciar sesión':'Sign in',
  'Prueba AgendaFlow gratis por 15 días. Después, $9.990 CLP al mes. Configura tus servicios y horarios online, con apoyo si lo necesitas.':'Try AgendaFlow free for 15 days. Then CLP $9,990/month. Set up your services and hours online, with help if you need it.',
  'Ingresa a tu cuenta para revisar tus reservas y mantener tu negocio en orden.':'Sign in to review your bookings and keep your business organized.',
  'Nombre del negocio':'Business name','Actividad o tipo de negocio':'Business type','Correo electrónico':'Email address','Contraseña':'Password',
  'Un momento...':'One moment...','Comenzar demo por 15 días':'Start 15-day trial','Entrar':'Sign in',
  '¿Ya tienes cuenta?':'Already have an account?','¿Primera vez en AgendaFlow?':'New to AgendaFlow?','Inicia sesión':'Sign in','Crear cuenta':'Create account',
  'Mis servicios':'My services','Configuración básica':'Basic settings',
  'Define qué ofreces y cuánto tiempo ocupa cada atención.':'Define what you offer and how long each appointment takes.',
  'Agregar servicio':'Add service','Servicios registrados':'Services added','Disponibles para reservar':'Available for booking',
  'Listado de servicios':'Service list','Disponible':'Available','Pausado':'Paused',
  'Todavía no tienes servicios. Agrega el primero para recibir reservas.':'You don’t have any services yet. Add your first one to start receiving bookings.',
  'Guardar servicio':'Save service','Guardar':'Save','Cancelar':'Cancel','Eliminar':'Delete',
  'Tu día está despejado':'Your day is clear','No tienes reservas para esta fecha.':'You have no bookings on this date.',
  'Reservas del día':'Today’s bookings','Confirmadas':'Confirmed','Por confirmar':'Pending confirmation',
  'Volver a hoy':'Back to today','Día':'Day','Semana':'Week','Nueva reserva':'New booking',
  'Compartir enlace':'Share link','Enlace copiado':'Link copied','Organiza tus horas y mantén todo bajo control.':'Organize your appointments and keep everything under control.',
  'Nombre del cliente':'Customer name','Teléfono':'Phone','Servicio':'Service','Fecha':'Date','Hora':'Time',
  'Notas (opcional)':'Notes (optional)','Pendiente':'Pending','Confirmada':'Confirmed','Completada':'Completed','Cancelada':'Cancelled',
  'Reservas del día':'Today’s bookings','Sin reservas':'No bookings','Nombre del negocio':'Business name',
  'WhatsApp (con código de país)':'WhatsApp (with country code)','Guardar datos':'Save details','Guardado':'Saved'
};
type LanguageContextValue = { language: Language; setLanguage: (language: Language) => void; t: (text: string) => string };
const LanguageContext = createContext<LanguageContextValue | null>(null);
export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>('es');
  useEffect(() => { const saved = window.localStorage.getItem('agendaflow-language'); if(saved === 'en' || saved === 'es') setLanguageState(saved); }, []);
  const setLanguage = (next: Language) => { setLanguageState(next); window.localStorage.setItem('agendaflow-language', next); document.documentElement.lang = next; };
  const t = (text: string) => language === 'en' ? (translations[text] || text) : text;
  return <LanguageContext.Provider value={{ language, setLanguage, t }}>{children}</LanguageContext.Provider>;
}
export function useLanguage() {
  const value = useContext(LanguageContext);
  if (!value) throw new Error('useLanguage must be used inside LanguageProvider');
  return value;
}
export function LanguageToggle({ className = '' }: { className?: string }) {
  const { language, setLanguage } = useLanguage();
  return <div role="group" aria-label="Language" className={`inline-flex items-center rounded-full border border-[#E2E9E5] bg-white p-1 ${className}`}>
    <button type="button" onClick={() => setLanguage('es')} aria-pressed={language === 'es'} className={`rounded-full px-2.5 py-1.5 text-[10px] font-bold ${language === 'es' ? 'bg-[#172B3A] text-white' : 'text-[#718087]'}`}>ES</button>
    <button type="button" onClick={() => setLanguage('en')} aria-pressed={language === 'en'} className={`rounded-full px-2.5 py-1.5 text-[10px] font-bold ${language === 'en' ? 'bg-[#172B3A] text-white' : 'text-[#718087]'}`}>EN</button>
  </div>;
}
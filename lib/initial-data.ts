import type { AgendaData } from './types';
const today = new Date();
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
export const initialData: AgendaData = {
  businessName: 'Estudio Central', slug: 'estudio-central', phone: '56912345678',
  services: [
    { id: 's1', name: 'Corte clásico', duration: 30, price: 12000, active: true },
    { id: 's2', name: 'Corte + barba', duration: 45, price: 18000, active: true },
    { id: 's3', name: 'Perfilado', duration: 30, price: 9000, active: true },
  ],
  hours: [
    { day: 'Lunes', enabled: true, open: '09:00', close: '18:00' }, { day: 'Martes', enabled: true, open: '09:00', close: '18:00' },
    { day: 'Miércoles', enabled: true, open: '09:00', close: '18:00' }, { day: 'Jueves', enabled: true, open: '09:00', close: '18:00' },
    { day: 'Viernes', enabled: true, open: '09:00', close: '18:00' }, { day: 'Sábado', enabled: true, open: '10:00', close: '14:00' },
    { day: 'Domingo', enabled: false, open: '10:00', close: '14:00' },
  ], blocked: [],
  appointments: [
    { id:'AF-1042', date:iso(today), time:'09:30', customer:'Matías González', phone:'56911111111', serviceId:'s1', notes:'', status:'confirmed' },
    { id:'AF-1043', date:iso(today), time:'10:30', customer:'Camila Rojas', phone:'56922222222', serviceId:'s2', notes:'', status:'confirmed' },
    { id:'AF-1044', date:iso(today), time:'12:00', customer:'Javiera Soto', phone:'56933333333', serviceId:'s3', notes:'Prefiere atención tranquila', status:'pending' },
  ]
};

export type AppointmentStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled';
export type Service = { id: string; name: string; duration: number; price: number; active: boolean };
export type WorkingDay = { day: string; enabled: boolean; open: string; close: string };
export type BlockedTime = { id: string; date: string; start: string; end: string; reason: string };
export type Appointment = { id: string; date: string; time: string; customer: string; phone: string; serviceId: string; notes: string; status: AppointmentStatus };
export type AgendaData = { businessName: string; slug: string; phone: string; services: Service[]; hours: WorkingDay[]; blocked: BlockedTime[]; appointments: Appointment[] };

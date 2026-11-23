'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { CalendarDays, LockKeyhole, CreditCard, LogOut, MessageCircle } from 'lucide-react';

export default function ExpiredAccountPage() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [paymentBusy, setPaymentBusy] = useState(false);
  // Keep the support button visible even if the Preview environment variable is missing.
  const whatsappNumber = (process.env.NEXT_PUBLIC_AGENDAFLOW_WHATSAPP || '56979060279').replace(/[^0-9]/g, '');
  const whatsappMessage = encodeURIComponent('Hola, tengo dudas sobre la activación de mi suscripción a FlowAgenda.');
  const startPayment = async () => {
    setPaymentBusy(true);
    setError('');
    try {
      const response = await fetch('/api/billing/mercadopago/create', { method: 'POST' });
      const result = await response.json();
      if (!response.ok || !result.checkoutUrl) {
        setError(result.error || 'No pudimos iniciar el pago. Intenta nuevamente.');
        setPaymentBusy(false);
        return;
      }
      window.location.assign(result.checkoutUrl);
    } catch {
      setError('No pudimos conectar con Mercado Pago. Revisa tu conexión e intenta nuevamente.');
      setPaymentBusy(false);
    }
  };
  const logout = async () => {
    setBusy(true);
    setError('');
    const { error: signOutError } = await createClient().auth.signOut();
    if (signOutError) {
      setError('No pudimos cerrar la sesión. Intenta nuevamente.');
      setBusy(false);
      return;
    }
    router.push('/login');
  };

  return <main className="grid min-h-screen place-items-center bg-[#F5F7F4] p-5">
    <section className="panel w-full max-w-md p-8 text-center">
      <div className="brand-mark mx-auto mb-5"><CalendarDays size={20}/></div>
      <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-[#f5eddd] text-[#a38a60]"><LockKeyhole size={22}/></div>
      <p className="eyebrow">Periodo de prueba finalizado</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">Tu agenda está pausada</h1>
      <p className="mt-3 text-sm leading-6 text-[#718087]">Tus datos se conservan. Para volver a gestionar reservas, activa tu suscripción mensual de FlowAgenda.</p>
      <div className="mt-5 rounded-xl bg-[#DCEBE6] p-4 text-left">
        <p className="text-sm font-semibold text-[#24514E]">$9.990 CLP / mes</p>
        <p className="mt-1 text-xs text-[#718087]">Activa tu suscripción mensual para recuperar el acceso a tu agenda.</p>
      </div>
      <button onClick={startPayment} disabled={paymentBusy} className="btn-primary mt-5 w-full"><CreditCard size={15}/> {paymentBusy ? 'Abriendo Mercado Pago...' : 'Activar suscripción'}</button>
      <a href={`https://wa.me/${whatsappNumber}?text=${whatsappMessage}`} target="_blank" rel="noopener noreferrer" className="btn-secondary mt-3 w-full"><MessageCircle size={15}/> ¿Tienes dudas? Escríbenos por WhatsApp</a>
      <button onClick={logout} disabled={busy} className="btn-secondary mt-3 w-full"><LogOut size={14}/>{busy ? 'Cerrando sesión...' : 'Cerrar sesión'}</button>
      {error && <p role="alert" className="mt-3 text-xs text-[#a45f52]">{error}</p>}
      <Link href="/" className="mt-5 inline-block text-xs text-[#718087] underline">Volver a FlowAgenda</Link>
    </section>
  </main>;
}

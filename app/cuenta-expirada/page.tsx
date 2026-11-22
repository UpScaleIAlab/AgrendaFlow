'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { CalendarDays, LockKeyhole, MessageCircle, LogOut } from 'lucide-react';

export default function ExpiredAccountPage() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
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
      <p className="mt-3 text-sm leading-6 text-[#718087]">Tus datos se conservan. Para volver a gestionar reservas, activa tu suscripción mensual de AgendaFlow.</p>
      <div className="mt-5 rounded-xl bg-[#DCEBE6] p-4 text-left">
        <p className="text-sm font-semibold text-[#24514E]">$9.990 CLP / mes</p>
        <p className="mt-1 text-xs text-[#718087]">La renovación y el pago online se habilitarán en la siguiente etapa.</p>
      </div>
      <a href="https://wa.me/56979060279?text=Hola%2C%20mi%20prueba%20de%20AgendaFlow%20termin%C3%B3%20y%20quiero%20consultar%20por%20la%20activaci%C3%B3n." target="_blank" rel="noreferrer" className="btn-primary mt-5 w-full"><MessageCircle size={15}/> Consultar activación</a>
      <button onClick={logout} disabled={busy} className="btn-secondary mt-3 w-full"><LogOut size={14}/>{busy ? 'Cerrando sesión...' : 'Cerrar sesión'}</button>
      {error && <p role="alert" className="mt-3 text-xs text-[#a45f52]">{error}</p>}
      <Link href="/" className="mt-5 inline-block text-xs text-[#718087] underline">Volver a AgendaFlow</Link>
    </section>
  </main>;
}

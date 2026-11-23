'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2, CalendarDays, ArrowUpRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { BrandLogo } from '@/components/brand-logo';

export default function EmailVerifiedPage() {
  const params = useSearchParams();
  const [status, setStatus] = useState<'checking'|'success'|'error'>('checking');
  const [message, setMessage] = useState('Estamos confirmando tu correo de forma segura.');

  useEffect(() => {
    let active = true;
    const verify = async () => {
      const supabase = createClient();
      const code = params.get('code');
      const errorDescription = params.get('error_description') || params.get('error');
      if (errorDescription) {
        if (active) {
          setStatus('error');
          setMessage('El enlace no pudo completarse. Puede haber vencido o ya haber sido utilizado. Intenta iniciar sesión o solicita otro correo de verificación.');
        }
        return;
      }
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user?.email_confirmed_at) {
            if (active) { setStatus('error'); setMessage('No pudimos completar la verificación. Solicita un nuevo enlace y vuelve a intentarlo.'); }
            return;
          }
        }
      }
      const { data: { user }, error } = await supabase.auth.getUser();
      if (active) {
        if (!error && user?.email_confirmed_at) setStatus('success');
        else {
          setStatus('error');
          setMessage('No pudimos confirmar el estado de tu correo. Prueba iniciar sesión; si tu cuenta sigue sin verificar, solicita un nuevo enlace.');
        }
      }
    };
    void verify();
    return () => { active = false; };
  }, [params]);

  return <main className="grid min-h-screen place-items-center bg-[#F5F7F4] p-4 sm:p-6">
    <section className="panel w-full max-w-md p-6 text-center sm:p-9">
      <BrandLogo compact className="mx-auto mb-6 w-[180px]" />
      <div className="brand-mark mx-auto mb-5"><CalendarDays size={20}/></div>
      {status === 'checking' ? <><h1 className="text-2xl font-semibold">Verificando tu correo...</h1><p className="mt-3 text-sm leading-6 text-[#718087]">{message}</p></> :
      status === 'success' ? <><CheckCircle2 className="mx-auto mb-4 text-[#397D78]" size={38}/><p className="eyebrow">Correo verificado</p><h1 className="mt-2 text-2xl font-semibold">¡Gracias por verificar tu cuenta!</h1><p className="mt-3 text-sm leading-6 text-[#718087]">Tu correo quedó confirmado correctamente. Ahora puedes iniciar sesión y comenzar a configurar tu agenda.</p><Link href="/login" className="btn-primary mt-6 w-full">Iniciar sesión <ArrowUpRight size={15}/></Link></> :
      <><p className="eyebrow">No pudimos completar el enlace</p><h1 className="mt-2 text-2xl font-semibold">Revisa tu verificación</h1><p role="alert" className="mt-3 text-sm leading-6 text-[#718087]">{message}</p><Link href="/login" className="btn-primary mt-6 w-full">Ir a iniciar sesión</Link><Link href="/registro" className="btn-secondary mt-3 w-full">Volver al registro</Link></>}
    </section>
  </main>;
}

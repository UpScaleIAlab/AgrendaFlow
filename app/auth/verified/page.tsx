'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CheckCircle2, CalendarDays, ArrowUpRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { BrandLogo } from '@/components/brand-logo';
import type { EmailOtpType } from '@supabase/supabase-js';

type VerificationStatus = 'checking' | 'success' | 'error';

export default function EmailVerifiedPage() {
  const router = useRouter();
  const [status, setStatus] = useState<VerificationStatus>('checking');
  const [message, setMessage] = useState('Estamos confirmando tu correo de forma segura.');

  useEffect(() => {
    if (status === 'success') {
      const redirectTimer = window.setTimeout(() => router.replace('/login?verified=1'), 1800);
      return () => window.clearTimeout(redirectTimer);
    }
  }, [status, router]);

  useEffect(() => {
    let active = true;

    const finish = (nextStatus: VerificationStatus, nextMessage: string) => {
      if (!active) return;
      setStatus(nextStatus);
      setMessage(nextMessage);
    };

    const showSuccess = () => finish(
      'success',
      'Tu correo quedó confirmado correctamente. Ahora puedes iniciar sesión.'
    );

    const verify = async () => {
      const supabase = createClient();
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');
      const tokenHash = params.get('token_hash');
      const rawType = params.get('type');
      const authError = params.get('error_description') || params.get('error');

      // Some confirmation links are already consumed by Supabase before the
      // browser reaches this page. If the account is confirmed, show success.
      const checkConfirmedUser = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        return Boolean(user?.email_confirmed_at);
      };

      if (authError) {
        if (await checkConfirmedUser()) {
          showSuccess();
          return;
        }
        finish(
          'error',
          'El enlace no pudo completarse. Puede haber vencido o ya haber sido utilizado. Si tu cuenta ya está verificada, intenta iniciar sesión; de lo contrario, solicita un nuevo correo.'
        );
        return;
      }

      if (tokenHash) {
        const allowedTypes: EmailOtpType[] = [
          'email', 'signup', 'invite', 'magiclink', 'recovery', 'email_change'
        ];
        const otpType = allowedTypes.includes(rawType as EmailOtpType)
          ? rawType as EmailOtpType
          : 'email';

        const { error } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: otpType,
        });

        // A successful verifyOtp is authoritative. Do not turn it into an
        // error merely because a follow-up user lookup has not settled yet.
        if (!error) {
          showSuccess();
          return;
        }

        if (await checkConfirmedUser()) {
          showSuccess();
          return;
        }

        finish(
          'error',
          'No pudimos validar este enlace. Puede haber vencido o ya haber sido utilizado. Si tu cuenta ya está verificada, inicia sesión; si no, solicita un nuevo enlace.'
        );
        return;
      }

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);

        // Successful code exchange means the confirmation callback completed.
        if (!error) {
          showSuccess();
          return;
        }

        if (await checkConfirmedUser()) {
          showSuccess();
          return;
        }

        finish(
          'error',
          'No pudimos completar la verificación. Solicita un nuevo enlace y vuelve a intentarlo.'
        );
        return;
      }

      if (await checkConfirmedUser()) {
        showSuccess();
        return;
      }

      finish(
        'error',
        'No encontramos un código de verificación válido. Abre el enlace más reciente que recibiste por correo.'
      );
    };

    void verify().catch(async () => {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.email_confirmed_at) {
          showSuccess();
          return;
        }
      } catch {
        // Fall through to the clear error state below.
      }

      finish(
        'error',
        'Ocurrió un problema al procesar el enlace. Si tu cuenta ya quedó verificada, puedes iniciar sesión; de lo contrario, solicita otro correo.'
      );
    });

    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="grid min-h-screen place-items-center bg-[#F5F7F4] p-4 sm:p-6">
      <section className="panel w-full max-w-md p-6 text-center sm:p-9">
        <BrandLogo compact className="mx-auto mb-6 w-[180px]" />
        <div className="brand-mark mx-auto mb-5"><CalendarDays size={20} /></div>

        {status === 'checking' ? (
          <>
            <h1 className="text-2xl font-semibold">Verificando tu correo...</h1>
            <p className="mt-3 text-sm leading-6 text-[#718087]">{message}</p>
          </>
        ) : status === 'success' ? (
          <>
            <CheckCircle2 className="mx-auto mb-4 text-[#397D78]" size={38} />
            <p className="eyebrow">Correo verificado</p>
            <h1 className="mt-2 text-2xl font-semibold">¡Gracias por verificar tu cuenta!</h1>
            <p className="mt-3 text-sm leading-6 text-[#718087]">
              Tu correo quedó confirmado correctamente. Te llevaremos al inicio de sesión para que ingreses a FM Digital Growth.
            </p>
            <Link href="/login?verified=1" className="btn-primary mt-6 w-full">
              Ir a iniciar sesión <ArrowUpRight size={15} />
            </Link>
          </>
        ) : (
          <>
            <p className="eyebrow">Verificación de correo</p>
            <h1 className="mt-2 text-2xl font-semibold">Revisa el estado de tu cuenta</h1>
            <p role="alert" className="mt-3 text-sm leading-6 text-[#718087]">{message}</p>
            <Link href="/login" className="btn-primary mt-6 w-full">Ir a iniciar sesión</Link>
            <Link href="/registro" className="btn-secondary mt-3 w-full">Volver al registro</Link>
          </>
        )}
      </section>
    </main>
  );
}

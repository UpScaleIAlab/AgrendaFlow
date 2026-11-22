import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST() {
  // This MVP uses a fixed Mercado Pago subscription-plan link.
  // No checkout is created through the API, and no MP credentials are needed here.
  const subscriptionUrl = process.env.MERCADOPAGO_SUBSCRIPTION_URL?.trim();

  if (!subscriptionUrl) {
    return NextResponse.json(
      { error: 'El enlace de suscripción aún no está configurado. Contacta a AgendaFlow.' },
      { status: 503 }
    );
  }

  try {
    const parsedUrl = new URL(subscriptionUrl);
    if (parsedUrl.protocol !== 'https:') {
      return NextResponse.json({ error: 'El enlace de suscripción no es válido.' }, { status: 503 });
    }
  } catch {
    return NextResponse.json({ error: 'El enlace de suscripción no es válido.' }, { status: 503 });
  }

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Inicia sesión para continuar.' }, { status: 401 });
  }

  const { data: business, error: businessError } = await supabase
    .from('businesses')
    .select('id,subscription_status')
    .eq('owner_id', user.id)
    .maybeSingle();

  if (businessError || !business) {
    return NextResponse.json({ error: 'No encontramos tu negocio.' }, { status: 404 });
  }

  if (business.subscription_status === 'active') {
    return NextResponse.json({ error: 'Tu suscripción ya está activa.' }, { status: 409 });
  }

  return NextResponse.json({ checkoutUrl: subscriptionUrl });
}

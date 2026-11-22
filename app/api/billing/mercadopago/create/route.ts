import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js';

export const runtime = 'nodejs';

const MP_API = 'https://api.mercadopago.com';
const MONTHLY_PRICE_CLP = 9990;

export async function POST() {
  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '');

  if (!accessToken || !siteUrl) {
    return NextResponse.json(
      { error: 'La integración de pagos aún no está configurada.' },
      { status: 503 }
    );
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json(
      { error: 'Falta configurar la credencial privada de Supabase.' },
      { status: 503 }
    );
  }

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Inicia sesión para continuar.' }, { status: 401 });
  }

  const { data: business, error: businessError } = await supabase
    .from('businesses')
    .select('id,name,subscription_status,mp_preapproval_id')
    .eq('owner_id', user.id)
    .maybeSingle();

  if (businessError || !business) {
    return NextResponse.json({ error: 'No encontramos tu negocio.' }, { status: 404 });
  }

  if (business.subscription_status === 'active') {
    return NextResponse.json({ error: 'Tu suscripción ya está activa.' }, { status: 409 });
  }

  // If an earlier checkout exists, reuse it rather than creating duplicate subscriptions.
  if (business.mp_preapproval_id) {
    const existingResponse = await fetch(
      `${MP_API}/preapproval/${encodeURIComponent(business.mp_preapproval_id)}`,
      { headers: { Authorization: `Bearer ${accessToken}` }, cache: 'no-store' }
    );
    if (existingResponse.ok) {
      const existing = await existingResponse.json();
      if (existing.init_point && ['pending', 'authorized'].includes(existing.status)) {
        return NextResponse.json({ checkoutUrl: existing.init_point });
      }
    }
  }

  const response = await fetch(`${MP_API}/preapproval`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      reason: `AgendaFlow - Suscripción mensual - ${business.name}`,
      external_reference: business.id,
      payer_email: user.email,
      back_url: `${siteUrl}/pago/resultado`,
      notification_url: `${siteUrl}/api/webhooks/mercadopago`,
      auto_recurring: {
        frequency: 1,
        frequency_type: 'months',
        transaction_amount: MONTHLY_PRICE_CLP,
        currency_id: 'CLP',
      },
    }),
    cache: 'no-store',
  });

  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.id || !result?.init_point) {
    console.error('Mercado Pago subscription creation failed:', result);
    return NextResponse.json(
      { error: 'Mercado Pago no pudo crear el checkout. Intenta nuevamente.' },
      { status: 502 }
    );
  }

  // The browser cannot update this protected column; only this server route can.
  const admin = createSupabaseAdmin(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error: updateError } = await admin
    .from('businesses')
    .update({ mp_preapproval_id: String(result.id) })
    .eq('id', business.id)
    .eq('owner_id', user.id);

  if (updateError) {
    console.error('Could not store Mercado Pago subscription id:', updateError.message);
    return NextResponse.json(
      { error: 'Se creó el checkout, pero no pudimos vincularlo. Contacta soporte antes de volver a pagar.' },
      { status: 500 }
    );
  }

  return NextResponse.json({ checkoutUrl: result.init_point });
}

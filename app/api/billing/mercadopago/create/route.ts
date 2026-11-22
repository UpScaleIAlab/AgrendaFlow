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

  // For sandbox tests, prefer the buyer test-account User ID and resolve its
  // Mercado Pago email through the API. Test-account usernames are not emails.
  const testPayerId = process.env.MERCADOPAGO_TEST_PAYER_ID?.trim();
  let payerEmail = process.env.MERCADOPAGO_TEST_PAYER_EMAIL?.trim() || user.email;

  if (testPayerId) {
    // Identify the collector (seller) tied to the configured Access Token.
    // Log IDs only; never log the credential or account email.
    const collectorResponse = await fetch(`${MP_API}/users/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    });
    const collector = await collectorResponse.json().catch(() => null);

    if (!collectorResponse.ok || !collector?.id) {
      console.error('Mercado Pago seller identity check failed:', {
        httpStatus: collectorResponse.status,
      });
      return NextResponse.json(
        { error: 'No pudimos identificar la cuenta vendedora de Mercado Pago con el token configurado.' },
        { status: 502 }
      );
    }

    console.info('Mercado Pago test account IDs:', {
      collectorId: String(collector.id),
      configuredPayerId: testPayerId,
      idsAreDifferent: String(collector.id) !== testPayerId,
    });

    const payerResponse = await fetch(
      `${MP_API}/users/${encodeURIComponent(testPayerId)}`,
      { headers: { Authorization: `Bearer ${accessToken}` }, cache: 'no-store' }
    );
    const payer = await payerResponse.json().catch(() => null);

    if (!payerResponse.ok || typeof payer?.email !== 'string' || !payer.email.includes('@')) {
      console.error('Could not resolve Mercado Pago test buyer from configured User ID.');
      return NextResponse.json(
        { error: 'No pudimos validar la cuenta compradora de prueba de Mercado Pago. Revisa el User ID configurado.' },
        { status: 502 }
      );
    }

    payerEmail = payer.email;
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
      payer_email: payerEmail,
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

import { createHmac, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

const MP_API = 'https://api.mercadopago.com';

function validSignature(signature: string | null, requestId: string | null, dataId: string, secret: string) {
  if (!signature || !requestId || !dataId) return false;
  const parts = Object.fromEntries(
    signature.split(',').map((part) => {
      const [key, value] = part.trim().split('=');
      return [key, value];
    })
  );
  if (!parts.ts || !parts.v1) return false;
  const manifest = `id:${dataId.toLowerCase()};request-id:${requestId};ts:${parts.ts};`;
  const expected = createHmac('sha256', secret).update(manifest).digest();
  let received: Buffer;
  try {
    received = Buffer.from(parts.v1, 'hex');
  } catch {
    return false;
  }
  return expected.length === received.length && timingSafeEqual(expected, received);
}

async function getMpResource(path: string, token: string) {
  const response = await fetch(`${MP_API}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`Mercado Pago resource returned ${response.status}`);
  return response.json();
}

export async function POST(request: Request) {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!token || !secret || !supabaseUrl || !serviceKey) {
    console.error('Mercado Pago webhook environment variables are missing.');
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 });
  }

  const url = new URL(request.url);
  const dataId = (url.searchParams.get('data.id') || url.searchParams.get('id') || '').trim();
  const requestId = request.headers.get('x-request-id');
  if (!validSignature(request.headers.get('x-signature'), requestId, dataId, secret)) {
    return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const topic = String(url.searchParams.get('type') || url.searchParams.get('topic') || body.type || '');
  if (!dataId) return NextResponse.json({ received: true });

  try {
    let subscription: any;

    if (topic === 'subscription_authorized_payment') {
      const payment = await getMpResource(`/authorized_payments/${encodeURIComponent(dataId)}`, token);
      if (!payment.preapproval_id) return NextResponse.json({ received: true });
      subscription = await getMpResource(
        `/preapproval/${encodeURIComponent(String(payment.preapproval_id))}`,
        token
      );
      if (payment.status === 'approved' || payment.status === 'authorized') {
        subscription.status = 'authorized';
      } else if (['rejected', 'cancelled'].includes(payment.status)) {
        subscription.status = 'past_due';
      }
    } else if (topic === 'subscription_preapproval' || topic === 'preapproval') {
      subscription = await getMpResource(`/preapproval/${encodeURIComponent(dataId)}`, token);
    } else {
      // Ignore unrelated Mercado Pago events.
      return NextResponse.json({ received: true });
    }

    const businessId = String(subscription.external_reference || '');
    const subscriptionId = String(subscription.id || '');
    if (!businessId || !subscriptionId) return NextResponse.json({ received: true });

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const status = subscription.status;
    let subscriptionStatus: 'active' | 'past_due' | 'cancelled' | null = null;
    if (status === 'authorized') subscriptionStatus = 'active';
    else if (status === 'cancelled') subscriptionStatus = 'cancelled';
    else if (status === 'paused' || status === 'past_due') subscriptionStatus = 'past_due';

    if (subscriptionStatus) {
      const nextPayment = subscription.auto_recurring?.next_payment_date;
      const periodEnd = subscriptionStatus === 'active'
        ? (nextPayment && new Date(nextPayment) > new Date()
          ? new Date(nextPayment).toISOString()
          : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString())
        : null;

      const { data: linkedBusiness, error: lookupError } = await admin
        .from('businesses')
        .select('mp_preapproval_id')
        .eq('id', businessId)
        .maybeSingle();
      if (lookupError) throw lookupError;
      // The webhook may arrive before the checkout route stores the subscription ID.
      // Accept a blank link once, but never replace a different existing subscription.
      if (linkedBusiness && (!linkedBusiness.mp_preapproval_id || linkedBusiness.mp_preapproval_id === subscriptionId)) {
        const { error } = await admin
          .from('businesses')
          .update({
            subscription_status: subscriptionStatus,
            subscription_period_end: periodEnd,
            mp_preapproval_id: subscriptionId,
          })
          .eq('id', businessId);
        if (error) throw error;
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Mercado Pago webhook processing failed:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}

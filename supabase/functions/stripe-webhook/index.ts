// ══════════════════════════════════════════════════════════════
// stripe-webhook — Supabase Edge Function
// Gestisce gli eventi Stripe per aggiornare il piano coach
//
// Setup richiesto:
//   supabase secrets set STRIPE_SECRET_KEY=sk_live_...
//   supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
//
// Registrare l'URL webhook su Stripe Dashboard:
//   https://dashboard.stripe.com/webhooks
//   URL: https://<project-ref>.supabase.co/functions/v1/stripe-webhook
//   Events: checkout.session.completed, customer.subscription.updated,
//            customer.subscription.deleted
//
// Deploy:
//   supabase functions deploy stripe-webhook
// ══════════════════════════════════════════════════════════════

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno';

const cors = {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature'
};

// Mappa Price ID → (plan, athlete_limit)
// AGGIORNARE con i Price ID reali da Stripe Dashboard
const PRICE_TO_PLAN: Record<string, { plan: string; athlete_limit: number }> = {
    'price_XXXXX_pro_monthly':  { plan: 'pro',  athlete_limit: 999 },
    'price_XXXXX_pro_yearly':   { plan: 'pro',  athlete_limit: 999 },
    'price_XXXXX_team_monthly': { plan: 'team', athlete_limit: 999 }
};

serve(async (req: Request) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
        apiVersion: '2024-06-20',
        httpClient: Stripe.createFetchHttpClient()
    });

    const sig    = req.headers.get('stripe-signature');
    const secret = Deno.env.get('STRIPE_WEBHOOK_SECRET')!;
    const body   = await req.text();

    let event: Stripe.Event;
    try {
        event = await stripe.webhooks.constructEventAsync(body, sig!, secret);
    } catch (err) {
        console.error('[stripe-webhook] Firma non valida:', (err as Error).message);
        return new Response('Webhook Error: invalid signature', { status: 400 });
    }

    const adminSb = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    try {
        if (event.type === 'checkout.session.completed') {
            const session   = event.data.object as Stripe.Checkout.Session;
            const customerId = session.customer as string;
            const subId      = session.subscription as string;
            const uid        = session.subscription_data?.metadata?.supabase_uid
                             ?? (await stripe.customers.retrieve(customerId) as Stripe.Customer).metadata?.supabase_uid;

            if (!uid) { console.warn('[webhook] UID non trovato per customer', customerId); }
            else {
                const sub      = await stripe.subscriptions.retrieve(subId);
                const priceId  = sub.items.data[0]?.price?.id ?? '';
                const planInfo = PRICE_TO_PLAN[priceId] ?? { plan: 'pro', athlete_limit: 999 };

                await adminSb.from('coaches').update({
                    plan:                   planInfo.plan,
                    athlete_limit:          planInfo.athlete_limit,
                    subscription_status:    sub.status,
                    current_period_ends_at: new Date(sub.current_period_end * 1000).toISOString(),
                    stripe_customer_id:     customerId
                }).eq('user_id', uid);

                console.log(`[webhook] checkout.session.completed → uid=${uid} plan=${planInfo.plan}`);
            }
        }

        if (event.type === 'customer.subscription.updated') {
            const sub        = event.data.object as Stripe.Subscription;
            const customerId = sub.customer as string;
            const priceId    = sub.items.data[0]?.price?.id ?? '';
            const planInfo   = PRICE_TO_PLAN[priceId] ?? { plan: 'pro', athlete_limit: 999 };

            await adminSb.from('coaches').update({
                plan:                   sub.status === 'active' ? planInfo.plan : 'free',
                athlete_limit:          sub.status === 'active' ? planInfo.athlete_limit : 3,
                subscription_status:    sub.status,
                current_period_ends_at: new Date(sub.current_period_end * 1000).toISOString()
            }).eq('stripe_customer_id', customerId);

            console.log(`[webhook] subscription.updated → customer=${customerId} status=${sub.status}`);
        }

        if (event.type === 'customer.subscription.deleted') {
            const sub        = event.data.object as Stripe.Subscription;
            const customerId = sub.customer as string;

            await adminSb.from('coaches').update({
                plan:                   'free',
                athlete_limit:          3,
                subscription_status:    'canceled',
                current_period_ends_at: null
            }).eq('stripe_customer_id', customerId);

            console.log(`[webhook] subscription.deleted → customer=${customerId} downgrade to free`);
        }

        return new Response(JSON.stringify({ received: true }), {
            headers: { ...cors, 'Content-Type': 'application/json' }
        });

    } catch (err) {
        const msg = (err as Error).message ?? String(err);
        console.error('[stripe-webhook] Errore processing:', msg);
        return new Response(JSON.stringify({ error: msg }), {
            status: 500, headers: { ...cors, 'Content-Type': 'application/json' }
        });
    }
});

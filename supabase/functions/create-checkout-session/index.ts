// ══════════════════════════════════════════════════════════════
// create-checkout-session — Supabase Edge Function
// Crea una Stripe Checkout Session e restituisce l'URL di pagamento
//
// Setup richiesto:
//   supabase secrets set STRIPE_SECRET_KEY=sk_live_... (o sk_test_...)
//
// Deploy:
//   supabase functions deploy create-checkout-session
// ══════════════════════════════════════════════════════════════

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno';

const cors = {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

serve(async (req: Request) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

    try {
        const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
            apiVersion: '2024-06-20',
            httpClient: Stripe.createFetchHttpClient()
        });

        const supabase = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_ANON_KEY')!,
            { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
        );

        // Verifica autenticazione
        const { data: { user }, error: authErr } = await supabase.auth.getUser();
        if (authErr || !user) {
            return new Response(JSON.stringify({ error: 'Non autenticato' }), {
                status: 401, headers: { ...cors, 'Content-Type': 'application/json' }
            });
        }

        const { price_id, success_url, cancel_url } = await req.json();
        if (!price_id) {
            return new Response(JSON.stringify({ error: 'price_id mancante' }), {
                status: 400, headers: { ...cors, 'Content-Type': 'application/json' }
            });
        }

        // Recupera o crea Stripe customer per questo coach
        const adminSb = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        );
        const { data: coachRow } = await adminSb
            .from('coaches')
            .select('stripe_customer_id')
            .eq('user_id', user.id)
            .single();

        let customerId = coachRow?.stripe_customer_id;
        if (!customerId) {
            const customer = await stripe.customers.create({
                email: user.email,
                metadata: { supabase_uid: user.id }
            });
            customerId = customer.id;
            await adminSb.from('coaches').update({ stripe_customer_id: customerId }).eq('user_id', user.id);
        }

        const session = await stripe.checkout.sessions.create({
            customer: customerId,
            payment_method_types: ['card'],
            line_items: [{ price: price_id, quantity: 1 }],
            mode: 'subscription',
            success_url: success_url || `${req.headers.get('origin')}/?upgraded=1`,
            cancel_url: cancel_url  || `${req.headers.get('origin')}/`,
            allow_promotion_codes: true,
            subscription_data: {
                metadata: { supabase_uid: user.id }
            }
        });

        return new Response(JSON.stringify({ url: session.url }), {
            headers: { ...cors, 'Content-Type': 'application/json' }
        });

    } catch (err) {
        const msg = (err as Error).message ?? String(err);
        console.error('[create-checkout-session]', msg);
        return new Response(JSON.stringify({ error: msg }), {
            status: 500, headers: { ...cors, 'Content-Type': 'application/json' }
        });
    }
});

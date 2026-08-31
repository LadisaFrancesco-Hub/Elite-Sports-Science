import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
// esm.sh gestisce la compatibilità Node→Deno meglio di npm:
import webpush from 'https://esm.sh/web-push@3.6.7';

const VAPID_PUBLIC_KEY  = 'BOCUOjnvp-AMT2XtzjxHoKwUX_qXJsiLWC0cWzsCbRvhEos2Aa6BabBi8qeMlyup6bWXKMXMa-w-fL3C0hcYbB4';
const VAPID_PRIVATE_KEY = '-OrlG-zCSCsNrQPtAzX9xziLGHVK1IaVDPbon9wJ37o';
const VAPID_EMAIL       = 'ladisafrancesco03@gmail.com';

const cors = {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

serve(async (req: Request) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

    const logs: string[] = [];

    try {
        const { target_type, target_id, title, body } = await req.json();
        logs.push(`target_type=${target_type} target_id=${target_id}`);

        const supabase = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        );

        webpush.setVapidDetails(`mailto:${VAPID_EMAIL}`, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
        logs.push('VAPID configurato');

        let query = supabase.from('push_subscriptions').select('subscription');
        if (target_type === 'coach') {
            query = query.eq('user_type', 'coach');
        } else {
            query = query.eq('user_type', 'athlete').eq('athlete_id', target_id);
        }

        const { data: subs, error: dbErr } = await query;
        logs.push(`Subscriptions trovate: ${subs?.length ?? 0}${dbErr ? ' | DB err: ' + dbErr.message : ''}`);

        if (!subs?.length) {
            return new Response(
                JSON.stringify({ ok: false, reason: 'no_subscriptions', logs }),
                { headers: { ...cors, 'Content-Type': 'application/json' } }
            );
        }

        const results = await Promise.allSettled(
            subs.map(async (row) => {
                const sub = typeof row.subscription === 'string'
                    ? JSON.parse(row.subscription)
                    : row.subscription;
                logs.push(`Invio a: ${sub.endpoint.slice(0, 60)}...`);
                const r = await webpush.sendNotification(sub, JSON.stringify({ title, body, url: '/' }));
                logs.push(`Risposta FCM: ${r.statusCode}`);
                return r;
            })
        );

        const failures = results
            .filter(r => r.status === 'rejected')
            .map(r => (r as PromiseRejectedResult).reason?.message ?? 'unknown');

        if (failures.length) logs.push(`Errori: ${failures.join(' | ')}`);

        return new Response(
            JSON.stringify({ ok: failures.length === 0, sent: subs.length, failures: failures.length, failureReasons: failures, logs }),
            { headers: { ...cors, 'Content-Type': 'application/json' } }
        );

    } catch (err) {
        const msg = (err as Error).message ?? String(err);
        logs.push(`Eccezione: ${msg}`);
        console.error('[send-push]', msg);
        return new Response(
            JSON.stringify({ ok: false, error: msg, logs }),
            { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } }
        );
    }
});

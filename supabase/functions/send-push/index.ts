import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import webpush from 'npm:web-push';

const corsHeaders = {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

serve(async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const { target_type, target_id, title, body } = await req.json();

        // Usa service_role per leggere le subscriptions bypassando RLS
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        );

        webpush.setVapidDetails(
            `mailto:${Deno.env.get('VAPID_EMAIL')}`,
            Deno.env.get('VAPID_PUBLIC_KEY')!,
            Deno.env.get('VAPID_PRIVATE_KEY')!
        );

        // Recupera le subscription in base al target
        let query = supabase.from('push_subscriptions').select('subscription');
        if (target_type === 'coach') {
            query = query.eq('user_type', 'coach');
        } else {
            query = query.eq('user_type', 'athlete').eq('athlete_id', target_id);
        }

        const { data: subs, error } = await query;

        if (error) {
            console.error('DB error:', error);
            return new Response('DB error', { status: 500, headers: corsHeaders });
        }
        if (!subs?.length) {
            return new Response('No subscriptions', { status: 200, headers: corsHeaders });
        }

        // Invia a tutte le subscription trovate (un utente può avere più device)
        await Promise.allSettled(
            subs.map(s =>
                webpush.sendNotification(
                    JSON.parse(s.subscription),
                    JSON.stringify({ title, body, url: '/' })
                ).catch((e: Error) => {
                    // 410 Gone = subscription scaduta, andrebbe rimossa
                    console.warn(`Push failed (${e.message})`);
                })
            )
        );

        return new Response('OK', { status: 200, headers: corsHeaders });

    } catch (err) {
        console.error('send-push error:', err);
        return new Response(JSON.stringify({ error: (err as Error).message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import webpush from 'https://esm.sh/web-push@3.6.7';

// Stesse chiavi VAPID di send-push (stesso mittente push).
const VAPID_PUBLIC_KEY  = 'BOCUOjnvp-AMT2XtzjxHoKwUX_qXJsiLWC0cWzsCbRvhEos2Aa6BabBi8qeMlyup6bWXKMXMa-w-fL3C0hcYbB4';
const VAPID_PRIVATE_KEY = '-OrlG-zCSCsNrQPtAzX9xziLGHVK1IaVDPbon9wJ37o';
const VAPID_EMAIL       = 'ladisafrancesco03@gmail.com';

// Ora locale (Europe/Rome) in cui inviare i promemoria. Override via env REMINDER_HOUR.
const REMINDER_HOUR = parseInt(Deno.env.get('REMINDER_HOUR') ?? '8', 10);
const TZ = 'Europe/Rome';

const cors = {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
};

// Giorno della settimana (0=Dom..6=Sab, come getDay() nel client) e data YYYY-MM-DD nel fuso IT.
function romeNow(): { dow: number; date: string; hour: number } {
    const now = new Date();
    const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: TZ, weekday: 'short', hour: '2-digit', hour12: false,
        year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(now);
    const get = (t: string) => parts.find(p => p.type === t)?.value ?? '';
    const dowMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    return {
        dow: dowMap[get('weekday')] ?? new Date().getDay(),
        date: `${get('year')}-${get('month')}-${get('day')}`,
        hour: parseInt(get('hour'), 10),
    };
}

serve(async (req: Request) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

    const logs: string[] = [];
    try {
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
        );

        // Auth: il segreto vive solo nel DB (reminder_config, RLS → solo service role).
        // Il cron lo legge e lo passa in header; qui lo rileggiamo e confrontiamo.
        const { data: cfg } = await supabase.from('reminder_config').select('secret').limit(1).maybeSingle();
        const expected = cfg?.secret;
        if (expected && req.headers.get('x-cron-secret') !== expected) {
            return new Response(JSON.stringify({ ok: false, error: 'unauthorized' }),
                { status: 401, headers: { ...cors, 'Content-Type': 'application/json' } });
        }

        // force=true (body o query) bypassa il gate orario → utile per test manuali.
        let force = new URL(req.url).searchParams.get('force') === '1';
        try { const b = await req.json(); if (b?.force) force = true; } catch { /* body vuoto */ }

        const { dow, date, hour } = romeNow();
        logs.push(`Rome: dow=${dow} date=${date} hour=${hour} (target ${REMINDER_HOUR}) force=${force}`);

        if (!force && hour !== REMINDER_HOUR) {
            return new Response(JSON.stringify({ ok: true, skipped: 'not_reminder_hour', logs }),
                { headers: { ...cors, 'Content-Type': 'application/json' } });
        }

        webpush.setVapidDetails(`mailto:${VAPID_EMAIL}`, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

        // Atleti con reminder attivo.
        const { data: athletes } = await supabase
            .from('atleti').select('id, name, training_reminder')
            .neq('training_reminder', false);
        const athIds = (athletes ?? []).map(a => a.id);
        logs.push(`Atleti con reminder ON: ${athIds.length}`);
        if (!athIds.length) return new Response(JSON.stringify({ ok: true, sent: 0, logs }),
            { headers: { ...cors, 'Content-Type': 'application/json' } });

        // Giorni di allenamento (una riga per seduta → uniamo per atleta).
        const { data: schedRows } = await supabase
            .from('schedules').select('athlete_id, scheduled_days').in('athlete_id', athIds);
        const daysByAth: Record<string, Set<number>> = {};
        (schedRows ?? []).forEach(r => {
            if (!r.scheduled_days) return;
            (daysByAth[r.athlete_id] ??= new Set());
            (r.scheduled_days as number[]).forEach(d => daysByAth[r.athlete_id].add(d));
        });

        // Chi si allena OGGI (dow) secondo la programmazione.
        const dueToday = athIds.filter(id => daysByAth[id]?.has(dow));
        logs.push(`Programmati oggi: ${dueToday.length}`);
        if (!dueToday.length) return new Response(JSON.stringify({ ok: true, sent: 0, logs }),
            { headers: { ...cors, 'Content-Type': 'application/json' } });

        // Salta chi ha già loggato una sessione oggi.
        const { data: todaySess } = await supabase
            .from('sessions').select('athlete_id').eq('date', date).in('athlete_id', dueToday);
        const loggedToday = new Set((todaySess ?? []).map(s => s.athlete_id));
        const targets = dueToday.filter(id => !loggedToday.has(id));
        logs.push(`Da avvisare (non ancora loggati): ${targets.length}`);
        if (!targets.length) return new Response(JSON.stringify({ ok: true, sent: 0, logs }),
            { headers: { ...cors, 'Content-Type': 'application/json' } });

        // Subscription push degli atleti target.
        const { data: subs } = await supabase
            .from('push_subscriptions')
            .select('athlete_id, endpoint, subscription')
            .eq('user_type', 'athlete').in('athlete_id', targets);
        logs.push(`Subscription trovate: ${subs?.length ?? 0}`);

        const nameById: Record<string, string> = {};
        (athletes ?? []).forEach(a => { nameById[a.id] = a.name; });
        const staleEndpoints: string[] = [];
        let sent = 0;

        await Promise.allSettled((subs ?? []).map(async (row) => {
            const sub = typeof row.subscription === 'string' ? JSON.parse(row.subscription) : row.subscription;
            if (!sub?.endpoint) return;
            const first = (nameById[row.athlete_id] || '').split(' ')[0] || 'Ciao';
            try {
                await webpush.sendNotification(sub, JSON.stringify({
                    title: '🏋️ Allenamento di oggi',
                    body: `${first}, oggi hai una seduta in programma. Registrala per tenere aggiornati i tuoi progressi!`,
                    url: '/', tag: `reminder-${date}`, panel: 'sessione',
                }), { urgency: 'high', TTL: 43200 });
                sent++;
            } catch (e: any) {
                const sc = e.statusCode ?? 0;
                if (sc === 410 || sc === 412 || sc === 404) staleEndpoints.push(sub.endpoint);
                logs.push(`FCM ${sc}: ${e.message}`);
            }
        }));

        for (const ep of staleEndpoints) await supabase.from('push_subscriptions').delete().eq('endpoint', ep);
        if (staleEndpoints.length) logs.push(`${staleEndpoints.length} subscription stantie rimosse`);

        return new Response(JSON.stringify({ ok: true, sent, targets: targets.length, logs }),
            { headers: { ...cors, 'Content-Type': 'application/json' } });

    } catch (err) {
        const msg = (err as Error).message ?? String(err);
        console.error('[send-reminders]', msg);
        return new Response(JSON.stringify({ ok: false, error: msg, logs }),
            { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } });
    }
});

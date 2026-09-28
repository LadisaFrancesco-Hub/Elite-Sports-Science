import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ══════════════════════════════════════════════════════════════
// Elite Sports Science — Retention video form-check
//
// Cancella dallo Storage (bucket privato `form-checks`) i video più
// vecchi di RETENTION_DAYS e ripulisce onestamente i messaggi collegati.
// NB: cancellare da SQL `storage.objects` NON rimuove il file reale →
// serve l'API Storage (remove), da qui.
//
// Auth: riusa il segreto in `reminder_config` (RLS → solo service role).
// Il cron lo passa in header x-cron-secret; qui lo riconfrontiamo.
// ══════════════════════════════════════════════════════════════

const BUCKET = 'form-checks';
const RETENTION_DAYS = parseInt(Deno.env.get('FORM_CHECK_RETENTION_DAYS') ?? '30', 10);
const PAGE = 100;

const cors = {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
};

// Età del file: preferisce created_at dallo Storage; fallback al timestamp
// nel nome (`{ts}-{uid}.ext`, ts = Date.now() impostato dal client).
function fileEpochMs(name: string, created_at?: string | null): number {
    if (created_at) {
        const t = Date.parse(created_at);
        if (!Number.isNaN(t)) return t;
    }
    const lead = parseInt((name.split('-')[0] || ''), 10);
    return Number.isNaN(lead) ? Date.now() : lead;
}

serve(async (req: Request) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

    const logs: string[] = [];
    try {
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
        );

        // Auth col segreto condiviso del cron.
        const { data: cfg } = await supabase.from('reminder_config').select('secret').limit(1).maybeSingle();
        const expected = cfg?.secret;
        if (expected && req.headers.get('x-cron-secret') !== expected) {
            return new Response(JSON.stringify({ ok: false, error: 'unauthorized' }),
                { status: 401, headers: { ...cors, 'Content-Type': 'application/json' } });
        }

        // dryRun=1 → conta soltanto, non cancella (utile per verifica).
        let dryRun = new URL(req.url).searchParams.get('dryRun') === '1';
        try { const b = await req.json(); if (b?.dryRun) dryRun = true; } catch { /* body vuoto */ }

        const cutoff = Date.now() - RETENTION_DAYS * 86400_000;
        logs.push(`retention=${RETENTION_DAYS}gg cutoff=${new Date(cutoff).toISOString()} dryRun=${dryRun}`);

        // 1. Cartelle di primo livello (una per atleta: id = null).
        const folders: string[] = [];
        for (let offset = 0; ; offset += PAGE) {
            const { data, error } = await supabase.storage.from(BUCKET)
                .list('', { limit: PAGE, offset });
            if (error) throw new Error('list root: ' + error.message);
            if (!data || !data.length) break;
            data.forEach(e => { if (e.id === null) folders.push(e.name); });
            if (data.length < PAGE) break;
        }
        logs.push(`cartelle atleta: ${folders.length}`);

        // 2. File scaduti per cartella.
        const expired: string[] = [];
        for (const folder of folders) {
            for (let offset = 0; ; offset += PAGE) {
                const { data, error } = await supabase.storage.from(BUCKET)
                    .list(folder, { limit: PAGE, offset });
                if (error) { logs.push(`list ${folder}: ${error.message}`); break; }
                if (!data || !data.length) break;
                data.forEach(f => {
                    if (f.id === null) return; // sottocartella improbabile: salta
                    if (fileEpochMs(f.name, (f as any).created_at) < cutoff) expired.push(`${folder}/${f.name}`);
                });
                if (data.length < PAGE) break;
            }
        }
        logs.push(`file scaduti: ${expired.length}`);

        if (dryRun || !expired.length) {
            return new Response(JSON.stringify({ ok: true, removed: 0, expired: expired.length, dryRun, logs }),
                { headers: { ...cors, 'Content-Type': 'application/json' } });
        }

        // 3. Rimozione (a blocchi) + pulizia onesta dei messaggi collegati.
        let removed = 0;
        for (let i = 0; i < expired.length; i += PAGE) {
            const chunk = expired.slice(i, i + PAGE);
            const { error } = await supabase.storage.from(BUCKET).remove(chunk);
            if (error) { logs.push(`remove: ${error.message}`); continue; }
            removed += chunk.length;
            await supabase.from('messages')
                .update({ media_url: null, media_type: null, content: '🎥 Video non più disponibile (scaduto)' })
                .in('media_url', chunk);
        }
        logs.push(`file rimossi: ${removed}`);

        return new Response(JSON.stringify({ ok: true, removed, expired: expired.length, logs }),
            { headers: { ...cors, 'Content-Type': 'application/json' } });

    } catch (err) {
        const msg = (err as Error).message ?? String(err);
        console.error('[cleanup-form-checks]', msg);
        return new Response(JSON.stringify({ ok: false, error: msg, logs }),
            { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } });
    }
});

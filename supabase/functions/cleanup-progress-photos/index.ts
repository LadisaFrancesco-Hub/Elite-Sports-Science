import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ══════════════════════════════════════════════════════════════
// Elite Sports Science — Cleanup foto-progressi (orphan-only)
//
// A differenza di cleanup-form-checks, le foto-progressi NON vanno
// cancellate per età: il loro valore è il confronto longitudinale nel
// tempo. Questo job rimuove SOLO i file "orfani" nel bucket privato
// `progress-photos`: file in Storage senza più un riferimento in
// atleti.progress_photos (es. atleta eliminato, delete fallito a metà).
// Nessuna foto viva viene mai toccata.
//
// Sicurezza: GRACE_HOURS protegge i file appena caricati il cui update
// del JSONB potrebbe non essere ancora committato (evita falsi orfani).
//
// Auth: riusa il segreto in `reminder_config` (RLS → solo service role),
// passato dal cron in header x-cron-secret.
// ══════════════════════════════════════════════════════════════

const BUCKET = 'progress-photos';
const GRACE_HOURS = parseInt(Deno.env.get('PROGRESS_PHOTO_GRACE_HOURS') ?? '24', 10);
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

        // dryRun=1 → elenca soltanto, non cancella (utile per verifica).
        let dryRun = new URL(req.url).searchParams.get('dryRun') === '1';
        try { const b = await req.json(); if (b?.dryRun) dryRun = true; } catch { /* body vuoto */ }

        const graceCutoff = Date.now() - GRACE_HOURS * 3600_000;
        logs.push(`grace=${GRACE_HOURS}h cutoff=${new Date(graceCutoff).toISOString()} dryRun=${dryRun}`);

        // 1. Set dei path referenziati in atleti.progress_photos (fonte di verità).
        const referenced = new Set<string>();
        for (let from = 0; ; from += PAGE) {
            const { data, error } = await supabase
                .from('atleti')
                .select('progress_photos')
                .not('progress_photos', 'is', null)
                .range(from, from + PAGE - 1);
            if (error) throw new Error('read atleti: ' + error.message);
            if (!data || !data.length) break;
            for (const row of data) {
                const arr = (row as any).progress_photos;
                if (Array.isArray(arr)) {
                    for (const p of arr) { if (p && typeof p.path === 'string') referenced.add(p.path); }
                }
            }
            if (data.length < PAGE) break;
        }
        logs.push(`path referenziati: ${referenced.size}`);

        // 2. Cartelle di primo livello (una per atleta: id = null).
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

        // 3. File orfani per cartella (non referenziati + oltre la grace period).
        const orphans: string[] = [];
        let scanned = 0;
        for (const folder of folders) {
            for (let offset = 0; ; offset += PAGE) {
                const { data, error } = await supabase.storage.from(BUCKET)
                    .list(folder, { limit: PAGE, offset });
                if (error) { logs.push(`list ${folder}: ${error.message}`); break; }
                if (!data || !data.length) break;
                data.forEach(f => {
                    if (f.id === null) return; // sottocartella improbabile: salta
                    scanned++;
                    const full = `${folder}/${f.name}`;
                    if (referenced.has(full)) return;                              // foto viva
                    if (fileEpochMs(f.name, (f as any).created_at) > graceCutoff) return; // troppo recente
                    orphans.push(full);
                });
                if (data.length < PAGE) break;
            }
        }
        logs.push(`file scansionati: ${scanned} · orfani: ${orphans.length}`);

        if (dryRun || !orphans.length) {
            return new Response(JSON.stringify({ ok: true, removed: 0, orphans: orphans.length, scanned, dryRun, logs }),
                { headers: { ...cors, 'Content-Type': 'application/json' } });
        }

        // 4. Rimozione a blocchi (nessuna pulizia metadati: per definizione già assenti).
        let removed = 0;
        for (let i = 0; i < orphans.length; i += PAGE) {
            const chunk = orphans.slice(i, i + PAGE);
            const { error } = await supabase.storage.from(BUCKET).remove(chunk);
            if (error) { logs.push(`remove: ${error.message}`); continue; }
            removed += chunk.length;
        }
        logs.push(`file rimossi: ${removed}`);

        return new Response(JSON.stringify({ ok: true, removed, orphans: orphans.length, scanned, logs }),
            { headers: { ...cors, 'Content-Type': 'application/json' } });

    } catch (err) {
        const msg = (err as Error).message ?? String(err);
        console.error('[cleanup-progress-photos]', msg);
        return new Response(JSON.stringify({ ok: false, error: msg, logs }),
            { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } });
    }
});

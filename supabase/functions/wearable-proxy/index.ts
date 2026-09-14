// CoachOS — wearable-proxy Edge Function
// Gestisce: OAuth token exchange + API proxy per Whoop e Polar
// Secrets richiesti (supabase secrets set ...):
//   WHOOP_CLIENT_ID, WHOOP_CLIENT_SECRET
//   POLAR_CLIENT_ID, POLAR_CLIENT_SECRET

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const CORS = {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

    try {
        const { action, platform, code, redirect_uri, access_token, refresh_token } = await req.json();

        if (action === 'exchange') {
            return await exchangeToken(platform, code, redirect_uri);
        }
        if (action === 'sync') {
            return await syncData(platform, access_token);
        }
        if (action === 'refresh') {
            return await refreshToken(platform, refresh_token);
        }
        return json({ error: 'Unknown action' }, 400);

    } catch (e) {
        return json({ error: String(e) }, 500);
    }
});

// ── Token Exchange ────────────────────────────────────────────
async function exchangeToken(platform: string, code: string, redirect_uri: string) {
    if (platform === 'whoop') {
        const r = await fetch('https://api.prod.whoop.com/oauth/oauth2/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                grant_type:    'authorization_code',
                code,
                redirect_uri,
                client_id:     Deno.env.get('WHOOP_CLIENT_ID')     ?? '',
                client_secret: Deno.env.get('WHOOP_CLIENT_SECRET') ?? '',
            }),
        });
        const data = await r.json();
        if (!r.ok) return json({ error: data }, 400);

        // Fetch Whoop user ID
        const me = await whoopGet('/developer/v1/user/profile/basic', data.access_token);
        return json({ ...data, platform_user_id: String(me?.user_id ?? '') });
    }

    if (platform === 'polar') {
        const r = await fetch('https://polarremote.com/v2/oauth2/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': 'Basic ' + btoa(
                    `${Deno.env.get('POLAR_CLIENT_ID')}:${Deno.env.get('POLAR_CLIENT_SECRET')}`
                ),
            },
            body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri }),
        });
        const data = await r.json();
        if (!r.ok) return json({ error: data }, 400);

        // Register user on AccessLink (required first time)
        await fetch('https://www.polaraccesslink.com/v3/users', {
            method: 'POST',
            headers: {
                'Content-Type':  'application/json',
                'Accept':        'application/json',
                'Authorization': `Bearer ${data.access_token}`,
            },
            body: JSON.stringify({ 'member-id': String(data.x_user_id ?? data.user_id ?? '') }),
        });

        return json({ ...data, platform_user_id: String(data.x_user_id ?? '') });
    }

    return json({ error: `Unsupported platform: ${platform}` }, 400);
}

// ── Token Refresh ─────────────────────────────────────────────
async function refreshToken(platform: string, refresh_token: string) {
    if (platform === 'whoop') {
        const r = await fetch('https://api.prod.whoop.com/oauth/oauth2/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                grant_type:    'refresh_token',
                refresh_token,
                client_id:     Deno.env.get('WHOOP_CLIENT_ID')     ?? '',
                client_secret: Deno.env.get('WHOOP_CLIENT_SECRET') ?? '',
            }),
        });
        const data = await r.json();
        return r.ok ? json(data) : json({ error: data }, 400);
    }
    if (platform === 'polar') {
        const r = await fetch('https://polarremote.com/v2/oauth2/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': 'Basic ' + btoa(
                    `${Deno.env.get('POLAR_CLIENT_ID')}:${Deno.env.get('POLAR_CLIENT_SECRET')}`
                ),
            },
            body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token }),
        });
        const data = await r.json();
        return r.ok ? json(data) : json({ error: data }, 400);
    }
    return json({ error: 'Unsupported platform' }, 400);
}

// ── Sync today's health data ──────────────────────────────────
async function syncData(platform: string, access_token: string) {
    if (platform === 'whoop') {
        return await syncWhoop(access_token);
    }
    if (platform === 'polar') {
        return await syncPolar(access_token);
    }
    return json({ error: 'Unsupported platform' }, 400);
}

async function syncWhoop(access_token: string) {
    const today     = new Date();
    const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
    const tomorrow  = new Date(today); tomorrow.setDate(today.getDate() + 1);

    const fmt = (d: Date) => d.toISOString().replace(/\.\d{3}Z$/, 'Z');

    // Recovery (today's score = recupero notturno)
    const rec = await whoopGet(
        `/developer/v1/recovery?start=${fmt(yesterday)}&end=${fmt(tomorrow)}&limit=1`,
        access_token
    );
    // Sleep (ieri notte)
    const slp = await whoopGet(
        `/developer/v1/activity/sleep?start=${fmt(yesterday)}&end=${fmt(today)}&limit=1`,
        access_token
    );

    const recRecord = rec?.records?.[0];
    const slpRecord = slp?.records?.[0];

    const hrv           = recRecord?.score?.hrv_rmssd_milli
                            ? Math.round(recRecord.score.hrv_rmssd_milli / 10) / 100
                            : null;
    const rhr           = recRecord?.score?.resting_heart_rate ?? null;
    const recovery_score = recRecord?.score?.recovery_score ?? null;
    const sleep_hours   = slpRecord?.score?.total_in_bed_time_milli != null
                            ? Math.round(slpRecord.score.total_in_bed_time_milli / 360000) / 10
                            : null;

    return json({ hrv, rhr, recovery_score, sleep_hours, source: 'whoop' });
}

async function syncPolar(access_token: string) {
    const today = new Date().toISOString().slice(0, 10);

    // Polar daily activity summary
    const res = await fetch(
        `https://www.polaraccesslink.com/v3/users/continuous-activity/date/${today}`,
        { headers: { 'Authorization': `Bearer ${access_token}`, 'Accept': 'application/json' } }
    );
    if (!res.ok) return json({ hrv: null, rhr: null, recovery_score: null, sleep_hours: null, source: 'polar' });

    const data = await res.json();
    // Polar daily activity doesn't give HRV directly; return what's available
    return json({
        hrv:            data?.heart_rate?.average ?? null,
        rhr:            data?.heart_rate?.minimum ?? null,
        recovery_score: null,
        sleep_hours:    null,
        source:         'polar',
    });
}

// ── Helpers ───────────────────────────────────────────────────
async function whoopGet(path: string, token: string) {
    const r = await fetch(`https://api.prod.whoop.com${path}`, {
        headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!r.ok) return null;
    return r.json();
}

function json(data: unknown, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { ...CORS, 'Content-Type': 'application/json' },
    });
}

// coach-insight — sintesi settimanale IA per il coach.
// L'IA NON calcola nulla: riceve i KPI GIÀ calcolati dal motore deterministico
// (generateWeeklyInsight, ACWR, readiness, HRV, rischio) e li trasforma in un
// briefing da coach. Modello economico (Haiku) + prompt caching sul system.
// Auth: verify_jwt=true (solo coach loggato). La chiave sta nei secrets Supabase.
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MODEL = 'claude-haiku-4-5-20251001';

const SYSTEM_PROMPT = `Sei l'assistente di un preparatore atletico (S&C). Ricevi l'analisi settimanale di UN atleta, GIÀ CALCOLATA da un motore deterministico di sports science.

REGOLE FERREE:
- NON inventare, ricalcolare o stimare numeri. Usa SOLO i valori forniti.
- Non citare soglie universali di ACWR come verità: qui l'ACWR è individualizzato ed è un SUPPORTO alla decisione, non una predizione. Trattalo così.
- Parla come un collega S&C esperto: conciso, concreto, azionabile. Niente pop-science, niente disclaimer medici prolissi.
- Italiano. Massimo ~120 parole.

STRUTTURA (markdown leggero):
1. Una frase di quadro generale su come sta andando l'atleta questa settimana.
2. 2-3 bullet con i rilievi che contano di più, in ordine di priorità.
3. Una riga che inizia con "**Questa settimana:**" con l'azione concreta consigliata.

È una BOZZA che il coach revisiona prima di usarla.`;

function buildUserMessage(p: any): string {
  const ins = p.insight || {};
  const raw = p.raw || {};
  const findings = (ins.findings || [])
    .map((f: any, i: number) => `${i + 1}. [${f.level}] ${f.text}`)
    .join('\n');
  const rawLines = Object.entries(raw)
    .filter(([, v]) => v !== null && v !== undefined && v !== '')
    .map(([k, v]) => `- ${k}: ${v}`)
    .join('\n');

  return `Atleta: ${p.athleteName || 'n/d'}
Sport: ${p.sport || 'n/d'} · Obiettivo: ${p.goal || 'n/d'}
Aderenza: ${ins.nWeek ?? '?'}/${ins.target ?? '?'} sedute questa settimana
Verdetto motore: ${ins.headline || 'n/d'} (tono: ${ins.tone || 'n/d'})

Rilievi calcolati (priorità decrescente):
${findings || '(nessun rilievo)'}

Raccomandazione del motore (riformulala con parole tue, non copiarla):
${ins.rec || 'n/d'}

Numeri grezzi di contesto:
${rawLines || '(nessuno)'}`;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ ok: false, error: 'missing_api_key' }),
        { headers: { ...cors, 'Content-Type': 'application/json' } },
      );
    }

    const payload = await req.json();

    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 500,
        system: [{
          type: 'text',
          text: SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' }, // system fisso -> caching = costo ridotto
        }],
        messages: [{ role: 'user', content: buildUserMessage(payload) }],
      }),
    });

    if (!resp.ok) {
      const detail = await resp.text();
      return new Response(
        JSON.stringify({ ok: false, error: `anthropic_${resp.status}`, detail: detail.slice(0, 300) }),
        { headers: { ...cors, 'Content-Type': 'application/json' } },
      );
    }

    const data = await resp.json();
    const summary = data?.content?.[0]?.text ?? '';
    return new Response(
      JSON.stringify({ ok: true, summary, model: MODEL }),
      { headers: { ...cors, 'Content-Type': 'application/json' } },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ ok: false, error: String(e) }),
      { headers: { ...cors, 'Content-Type': 'application/json' } },
    );
  }
});

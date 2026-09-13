/* ══════════════════════════════════════════════════════════════
   ELITE SPORTS SCIENCE — nutrition.js
   Tracking macro giornaliero atleta (kcal, P/C/G).
   Coach può impostare target per atleta (DB.nutritionTargets[athId]).
   ══════════════════════════════════════════════════════════════ */

import { DB, appState } from './state.js';
import { toast, escHtml, openMo, closeMo } from './utils.js';


// ─────────────────────────────────────────────────────────────
// loadNutrition — carica dal cloud per l'atleta loggato
// ─────────────────────────────────────────────────────────────
export async function loadNutrition(athId) {
    if (!window.mySupabase || !athId) return;
    try {
        const { data } = await window.mySupabase
            .from('nutrition')
            .select('*')
            .eq('athlete_id', athId)
            .order('date', { ascending: false })
            .limit(90);
        if (data) DB.nutrition[athId] = data;
    } catch (e) {
        console.warn('[Nutrition] load error:', e);
    }
}


// ─────────────────────────────────────────────────────────────
// saveNutritionLog — salva/aggiorna il log di oggi
// ─────────────────────────────────────────────────────────────
export async function saveNutritionLog() {
    const athId = window.mioIdLoggato || appState.selAthId;
    if (!athId) return;

    const kcal  = parseInt(document.getElementById('nut-kcal')?.value)  || null;
    const prot  = parseFloat(document.getElementById('nut-prot')?.value) || null;
    const carb  = parseFloat(document.getElementById('nut-carb')?.value) || null;
    const fat   = parseFloat(document.getElementById('nut-fat')?.value)  || null;
    const note  = document.getElementById('nut-note')?.value.trim() || null;
    const date  = document.getElementById('nut-date')?.value || new Date().toISOString().slice(0,10);

    if (!kcal && !prot && !carb && !fat) { toast('Inserisci almeno un dato'); return; }

    const row = { athlete_id: athId, date, kcal, proteine: prot, carboidrati: carb, grassi: fat, note };

    if (!DB.nutrition[athId]) DB.nutrition[athId] = [];
    const idx = DB.nutrition[athId].findIndex(r => r.date === date);
    if (idx >= 0) DB.nutrition[athId][idx] = { ...DB.nutrition[athId][idx], ...row };
    else DB.nutrition[athId].unshift(row);

    try {
        if (window.mySupabase) {
            const { error } = await window.mySupabase.from('nutrition').upsert([row], { onConflict: 'athlete_id,date' });
            if (error) toast('⚠️ ' + error.message);
            else toast('✅ Nutrizione salvata');
        } else {
            toast('💾 Salvato localmente');
        }
    } catch (e) { toast('❌ ' + e.message); }

    closeMo('mo-nutrition');
    renderNutritionCard(athId);
}


// ─────────────────────────────────────────────────────────────
// openNutritionModal — apre il modal di log
// ─────────────────────────────────────────────────────────────
export function openNutritionModal(athId) {
    const today = new Date().toISOString().slice(0, 10);
    const existing = DB.nutrition[athId]?.find(r => r.date === today);

    const f = (id, val) => { const el = document.getElementById(id); if (el) el.value = val ?? ''; };
    f('nut-date', today);
    f('nut-kcal', existing?.kcal   || '');
    f('nut-prot', existing?.proteine    || '');
    f('nut-carb', existing?.carboidrati || '');
    f('nut-fat',  existing?.grassi      || '');
    f('nut-note', existing?.note   || '');

    openMo('mo-nutrition');
}


// ─────────────────────────────────────────────────────────────
// renderNutritionCard — card rapida per tab Progressi atleta
// ─────────────────────────────────────────────────────────────
export function renderNutritionCard(athId) {
    const el = document.getElementById('ap-nutrition');
    if (!el) return;

    const logs    = (DB.nutrition[athId] || []).slice(0, 7);
    const targets = DB.nutritionTargets?.[athId] || {};
    const today   = new Date().toISOString().slice(0, 10);
    const todayLog = logs.find(r => r.date === today);

    const macroBar = (val, target, color, label) => {
        if (!val && !target) return '';
        const pct = target && val ? Math.min(100, Math.round(val / target * 100)) : 0;
        return `
        <div style="margin-bottom:8px">
            <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:3px">
                <span style="color:var(--muted)">${label}</span>
                <span style="color:${color};font-weight:700">${val ?? '—'}${target ? ` / ${target}g` : 'g'}</span>
            </div>
            ${target ? `<div style="height:4px;background:var(--s1);border-radius:2px"><div style="height:100%;width:${pct}%;background:${color};border-radius:2px"></div></div>` : ''}
        </div>`;
    };

    const histHtml = logs.slice(0, 5).map(r => `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--border);font-size:11px">
            <span style="color:var(--muted)">${r.date.slice(5)}</span>
            <div style="display:flex;gap:10px">
                ${r.kcal ? `<span style="color:var(--teal);font-weight:700">${r.kcal} kcal</span>` : ''}
                ${r.proteine    ? `<span style="color:#60a5fa">P ${r.proteine}g</span>` : ''}
                ${r.carboidrati ? `<span style="color:var(--amber)">C ${r.carboidrati}g</span>` : ''}
                ${r.grassi      ? `<span style="color:#f472b6">G ${r.grassi}g</span>` : ''}
            </div>
        </div>`).join('');

    el.innerHTML = `
    <div class="card" style="border:1px solid var(--border)">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
            <div class="card-t">🥗 Nutrizione</div>
            <button onclick="openNutritionModal('${athId}')"
                style="font-size:11px;padding:4px 10px;background:var(--teal-d);border:1px solid rgba(249,115,22,.3);border-radius:6px;color:var(--teal);font-weight:700;cursor:pointer">
                + Log oggi
            </button>
        </div>
        ${todayLog ? `
        <div style="background:var(--s1);border-radius:8px;padding:12px;margin-bottom:12px">
            <div style="font-size:10px;color:var(--muted);margin-bottom:8px;font-weight:700;letter-spacing:.05em">OGGI</div>
            ${todayLog.kcal ? `<div style="font-size:20px;font-weight:800;color:var(--teal);margin-bottom:8px">${todayLog.kcal} kcal</div>` : ''}
            ${macroBar(todayLog.proteine,    targets.proteine,    '#60a5fa', 'Proteine')}
            ${macroBar(todayLog.carboidrati, targets.carboidrati, 'var(--amber)', 'Carboidrati')}
            ${macroBar(todayLog.grassi,      targets.grassi,      '#f472b6', 'Grassi')}
        </div>` : `
        <div style="text-align:center;padding:16px;color:var(--muted);font-size:12px;margin-bottom:12px">
            Nessun log per oggi — registra i tuoi macro
        </div>`}
        ${histHtml ? `<div style="font-size:10px;color:var(--muted);font-weight:700;letter-spacing:.05em;margin-bottom:4px">ULTIMI 5 GIORNI</div>${histHtml}` : ''}
    </div>`;
}


// ─────────────────────────────────────────────────────────────
// renderNutritionCoach — vista coach nel profilo atleta
// ─────────────────────────────────────────────────────────────
export function renderNutritionCoach(athId, containerId) {
    const el = document.getElementById(containerId);
    if (!el) return;

    const logs    = (DB.nutrition[athId] || []).slice(0, 14);
    const targets = DB.nutritionTargets?.[athId] || {};

    const avgKcal = logs.length
        ? Math.round(logs.reduce((a, r) => a + (r.kcal || 0), 0) / logs.filter(r => r.kcal).length) || 0
        : 0;
    const avgProt = logs.length
        ? Math.round(logs.reduce((a, r) => a + (r.proteine || 0), 0) / logs.filter(r => r.proteine).length * 10) / 10 || 0
        : 0;

    el.innerHTML = `
    <div class="card" style="border:1px solid var(--border);margin-top:12px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
            <div class="card-t">🥗 Nutrizione (ultimi 14gg)</div>
        </div>
        ${logs.length === 0 ? `<div style="color:var(--muted);font-size:12px;text-align:center;padding:12px">Nessun log ancora</div>` : `
        <div style="display:flex;gap:12px;margin-bottom:12px">
            <div class="kpi" style="flex:1"><div class="kpi-l">Media kcal/giorno</div><div class="kpi-v" style="font-size:18px;color:var(--teal)">${avgKcal || '—'}</div></div>
            <div class="kpi" style="flex:1"><div class="kpi-l">Media proteine/g</div><div class="kpi-v" style="font-size:18px;color:#60a5fa">${avgProt || '—'}</div></div>
        </div>
        <div style="font-size:10px;color:var(--muted);font-weight:700;letter-spacing:.05em;margin-bottom:6px">TARGET COACH</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">
            ${_targetInput('kcal', 'kcal/g', targets.kcal, athId)}
            ${_targetInput('proteine', 'P (g)', targets.proteine, athId)}
            ${_targetInput('carboidrati', 'C (g)', targets.carboidrati, athId)}
            ${_targetInput('grassi', 'G (g)', targets.grassi, athId)}
        </div>
        <button onclick="saveNutritionTargets('${athId}')"
            style="padding:8px 16px;background:var(--teal-d);border:1px solid rgba(249,115,22,.3);border-radius:8px;color:var(--teal);font-weight:700;font-size:12px;cursor:pointer">
            💾 Salva target
        </button>`}
    </div>`;
}

function _targetInput(field, label, val, athId) {
    return `<div style="display:flex;flex-direction:column;gap:3px;min-width:70px">
        <label style="font-size:9px;color:var(--muted);font-weight:700">${label}</label>
        <input type="number" id="nut-tgt-${field}" value="${val || ''}" placeholder="—"
               style="width:70px;padding:5px 8px;background:var(--s2);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:12px">
    </div>`;
}


// ─────────────────────────────────────────────────────────────
// saveNutritionTargets — coach salva target macro per atleta
// ─────────────────────────────────────────────────────────────
export async function saveNutritionTargets(athId) {
    const g = (id) => parseFloat(document.getElementById(id)?.value) || null;
    if (!DB.nutritionTargets) DB.nutritionTargets = {};
    DB.nutritionTargets[athId] = {
        kcal:        g('nut-tgt-kcal'),
        proteine:    g('nut-tgt-proteine'),
        carboidrati: g('nut-tgt-carboidrati'),
        grassi:      g('nut-tgt-grassi'),
    };
    await window.saveDB?.();
    toast('✅ Target macro salvati');
}

/* ══════════════════════════════════════════════════════════════
   ELITE SPORTS SCIENCE — nutrition.js
   Tracking macro giornaliero atleta (kcal, P/C/G).
   Coach può impostare target per atleta (DB.nutritionTargets[athId]).
   ══════════════════════════════════════════════════════════════ */

import { DB, appState } from './state.js';
import { toast, escHtml, openMo, closeMo, AX, axAreaFill, axChartOptions } from './utils.js';

let nutChartAthlete = null;
let nutChartCoach   = null;


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

    const allLogs = DB.nutrition[athId] || [];
    const targets = DB.nutritionTargets?.[athId] || {};
    // De-enfatizzata (posizionamento forza/atletica): la nutrizione è opt-in.
    // Mostrala SOLO se il coach ha impostato dei target o se ci sono già log —
    // così l'atleta di default non trova un "diario alimentare" che non useremmo
    // meglio di un tracker dedicato. Chi ha già dati la mantiene.
    const hasTargets = Object.values(targets).some(v => v != null && v !== '' && v !== 0);
    if (!hasTargets && allLogs.length === 0) { el.innerHTML = ''; return; }

    const logs    = allLogs.slice(0, 7);
    const today   = new Date().toISOString().slice(0, 10);
    const todayLog = logs.find(r => r.date === today);
    // Grafico 14gg solo se c'è almeno un dato: prima comparivano assi vuoti "0–1 kcal"
    const _cut = new Date(); _cut.setDate(_cut.getDate() - 13);
    const hasSeries = (DB.nutrition[athId] || []).some(r => r.date >= _cut.toISOString().slice(0, 10) && (r.kcal || r.proteine));

    const macroBar = (val, target, color, label) => {
        if (!val && !target) return '';
        const pct = target && val ? Math.min(100, Math.round(val / target * 100)) : 0;
        return `
        <div style="margin-bottom:8px">
            <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:3px">
                <span style="color:var(--muted)">${label}</span>
                <span style="color:var(--text);font-family:var(--fmono);font-weight:600">${val ?? '—'}${target ? `<span style="color:var(--muted)"> / ${target}g</span>` : 'g'}</span>
            </div>
            ${target ? `<div class="ax-progress" style="height:4px"><i style="width:${pct}%"></i></div>` : ''}
        </div>`;
    };

    const histHtml = logs.slice(0, 5).map(r => `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--border);font-size:11px">
            <span style="color:var(--muted)">${r.date.slice(5)}</span>
            <div style="display:flex;gap:10px">
                ${r.kcal ? `<span style="color:var(--text);font-family:var(--fmono);font-weight:600">${r.kcal} kcal</span>` : ''}
                ${r.proteine    ? `<span style="color:var(--text2);font-family:var(--fmono)"><span style="color:var(--dim2)">P</span> ${r.proteine}g</span>` : ''}
                ${r.carboidrati ? `<span style="color:var(--text2);font-family:var(--fmono)"><span style="color:var(--dim2)">C</span> ${r.carboidrati}g</span>` : ''}
                ${r.grassi      ? `<span style="color:var(--text2);font-family:var(--fmono)"><span style="color:var(--dim2)">G</span> ${r.grassi}g</span>` : ''}
            </div>
        </div>`).join('');

    el.innerHTML = `
    <div class="card">
        <div class="card-t" style="display:flex;justify-content:space-between;align-items:center">
            <span>Aderenza nutrizionale</span>
            <button onclick="openNutritionModal('${athId}')" class="ax-pill-btn" style="cursor:pointer;letter-spacing:0;font-family:var(--fm)">
                + Aggiorna
            </button>
        </div>
        ${todayLog ? `
        <div style="background:var(--e2);border:1px solid var(--line);border-radius:12px;padding:12px 14px;margin-bottom:12px">
            <div class="ax-overline" style="margin-bottom:6px">Oggi</div>
            ${todayLog.kcal ? `<div class="ax-stat-v" style="color:var(--accent);margin-bottom:10px">${todayLog.kcal}<span style="font-size:13px;color:var(--muted)"> kcal</span></div>` : ''}
            ${macroBar(todayLog.proteine,    targets.proteine,    null, 'Proteine')}
            ${macroBar(todayLog.carboidrati, targets.carboidrati, null, 'Carboidrati')}
            ${macroBar(todayLog.grassi,      targets.grassi,      null, 'Grassi')}
        </div>` : `
        <div style="text-align:center;padding:14px;color:var(--muted);font-size:12.5px;margin-bottom:${hasSeries ? '12px' : '0'};border:1px dashed var(--line-hi);border-radius:12px">
            Nessun dato oggi — inserisci i totali dal tuo tracker (es. MyFitnessPal)
        </div>`}
        ${histHtml ? `<div class="ax-overline" style="margin:4px 0 4px">Ultimi 5 giorni</div>${histHtml}` : ''}
        ${hasSeries ? `<div style="position:relative;height:180px;margin-top:16px;">
            <canvas id="nut-chart-athlete"></canvas>
        </div>` : ''}
    </div>`;

    if (nutChartAthlete) { nutChartAthlete.destroy(); nutChartAthlete = null; }
    nutChartAthlete = _buildNutChart('nut-chart-athlete', athId, null, 14);
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
            <div class="kpi" style="flex:1"><div class="kpi-l">Media proteine/g</div><div class="kpi-v" style="font-size:18px;color:var(--text2)">${avgProt || '—'}</div></div>
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
        </button>
        <div style="position:relative;height:180px;margin-top:16px;">
            <canvas id="nut-chart-coach"></canvas>
        </div>`}
    </div>`;

    if (logs.length > 0) {
        if (nutChartCoach) { nutChartCoach.destroy(); nutChartCoach = null; }
        nutChartCoach = _buildNutChart('nut-chart-coach', athId, null, 14);
    }
}

function _buildNutChart(canvasId, athId, instanceRef, days = 14) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || typeof Chart === 'undefined') return null;

    const targets = DB.nutritionTargets?.[athId] || {};
    const logs    = DB.nutrition[athId] || [];

    // Costruisce array degli ultimi N giorni (null = dato mancante)
    const labels = [], kcalData = [], protData = [];
    for (let i = days - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().slice(0, 10);
        const log = logs.find(r => r.date === dateStr);
        labels.push(dateStr.slice(5));
        kcalData.push(log?.kcal       ?? null);
        protData.push(log?.proteine   ?? null);
    }

    const monoFont = { size: 9, family: "'IBM Plex Mono', monospace" };
    const gridCol  = 'rgba(255,255,255,0.05)';
    const tickCol  = '#5E6873';

    const datasets = [
        {
            label: 'kcal',
            data: kcalData,
            borderColor: AX.accent,
            backgroundColor: axAreaFill(0.22),
            borderWidth: 2.5,
            pointBackgroundColor: AX.accentHi,
            pointBorderColor: AX.bg,
            pointBorderWidth: 2,
            pointRadius: 3,
            tension: 0.3,
            fill: true,
            spanGaps: false,
            yAxisID: 'yKcal'
        },
        {
            label: 'proteine (g)',
            data: protData,
            borderColor: AX.neutral,
            backgroundColor: 'transparent',
            borderWidth: 1.75,
            borderDash: [5, 4],
            pointBackgroundColor: AX.neutral,
            pointBorderColor: AX.bg,
            pointBorderWidth: 1.5,
            pointRadius: 3.5,
            tension: 0.3,
            fill: false,
            spanGaps: false,
            yAxisID: 'yProt'
        }
    ];

    if (targets.kcal) datasets.push({
        label: 'target kcal',
        data: Array(days).fill(targets.kcal),
        borderColor: 'rgba(255,144,68,.4)',
        borderWidth: 1.5,
        borderDash: [4, 4],
        pointRadius: 0,
        fill: false,
        yAxisID: 'yKcal'
    });

    if (targets.proteine) datasets.push({
        label: 'target proteine',
        data: Array(days).fill(targets.proteine),
        borderColor: 'rgba(154,163,174,.35)',
        borderWidth: 1.5,
        borderDash: [4, 4],
        pointRadius: 0,
        fill: false,
        yAxisID: 'yProt'
    });

    if (instanceRef) instanceRef.destroy();

    return new Chart(canvas, {
        type: 'line',
        data: { labels, datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: {
                    display: true,
                    labels: { color: tickCol, font: monoFont, boxWidth: 8, boxHeight: 8, usePointStyle: true, padding: 12,
                        filter: item => !item.text.startsWith('target') }
                },
                tooltip: axChartOptions().plugins.tooltip
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { color: tickCol, font: monoFont, maxRotation: 0, maxTicksLimit: 7 }
                },
                yKcal: {
                    position: 'left',
                    grid: { color: gridCol },
                    ticks: { color: AX.accent, font: monoFont, maxTicksLimit: 5, callback: v => v + ' kcal' }
                },
                yProt: {
                    position: 'right',
                    grid: { display: false },
                    ticks: { color: AX.neutral, font: monoFont, maxTicksLimit: 5, callback: v => v + 'g' }
                }
            }
        }
    });
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

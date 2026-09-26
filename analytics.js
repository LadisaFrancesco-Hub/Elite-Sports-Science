/* ══════════════════════════════════════════════════════════════
  ELITE SPORTS SCIENCE — analytics.js
  Responsabilità:
  1. calculateACWR(athId) — EWMA duale Gym/Campo
  2. window.renderE1rmChart() — Grafico line e1RM per settimana
  3. window.renderAnalytics() — Orchestratore pannello Analytics:
  4. calculateEfficiencyIndex(athId) — Tonnellaggio / sRPE per settimana
  5. calculateProgressionIndex(exName) — % incremento e1RM settimanale
  6. getRollingHrvTrend(athId, days) — Media mobile 7 gg HRV
  a. Sottotitolo + storico antropometrico
  b. Spark cards (Volume / sRPE / e1RM)
  c. LSI — Limb Symmetry Index
  d. ACWR insight box
  e. Indici di Foster (Monotonia + Strain)
  f. Scatter HRV vs Performance
  g. Radar — Profilo Biologico (6 assi)
  h. Peaking/Tapering — Grafico a doppia scala

  Istanze Chart.js esposte globalmente (per destroy/recreate):
  window.radarChartInstance
  window.peakingChartInstance
  e1rmChartInstance (let — locale al modulo)
  hrvPerfChart (let — locale al modulo)

  Dipendenze globali (definite in app.js / auth.js / wellness.js):
  DB, appState.selAthId, athById(), calculateACWR()
  ══════════════════════════════════════════════════════════════ */

import { DB, appState } from './state.js';
import { uid, escHtml, toast, athName, athById, AX, axAreaFill, axChartOptions, axLastPointOnly, axHonestRange } from './utils.js';
import { renderBadgesSection } from './badges.js';
import { renderNutritionCard } from './nutrition.js';


// Istanze Chart.js — distrutte e ricreate ad ogni render
let e1rmChartInstance = null;
let hrvPerfChart = null;
let bodyCompChart = null;
let testChartInstance = null;


// ─────────────────────────────────────────────────────────────
// 1. calculateACWR(athId)
// Acute:Chronic Workload Ratio su due binari indipendenti (EWMA):
//   Binario GYM   → tonnellaggio meccanico (kg)
//   Binario CAMPO → carico specifico sRPE (UA)
//   αAcute ≈ 0.33 (~1 sett.), αChronic ≈ 0.05 (~4 sett.)
//
// L'ACWR è un DESCRITTORE DI TREND del carico, non una predizione di
// infortunio (la letteratura sulle soglie universali 0.8–1.3/1.5 è
// contestata: Lolli, Impellizzeri, Coutts). Perciò:
//   1. INDIVIDUALIZZATO — quando c'è abbastanza storico, il valore è
//      classificato via z-score rispetto allo standard personale
//      dell'atleta, non a soglie universali. Fallback alle soglie
//      generiche solo con poco storico. Un "floor" assoluto evita che
//      un baseline rumoroso nasconda un picco reale (>1.5 / >2.0).
//   3. GATE PER-BINARIO su tempo di calendario + numero sessioni.
//
// Restituisce per binario: { value, text, color, level, z, baseline, note }
//   level ∈ 'insufficient' | 'low' | 'optimal' | 'elevated' | 'high'
//   (i consumatori usano `level`, non il match sulla stringa `text`).
// ─────────────────────────────────────────────────────────────
const _ACWR_MIN_SESSIONS = 6;   // sessioni minime nel binario
const _ACWR_MIN_SPAN_DAYS = 21; // arco di calendario minimo (~3 sett.)
const _ACWR_MIN_BASELINE = 8;   // campioni di ratio per fidarsi dello standard personale

const _ACWR_COLOR = {
  insufficient: 'var(--muted)',
  low:          'var(--muted)',
  optimal:      'var(--green)',
  elevated:     'var(--amber)',
  high:         'var(--coral)',
};

function _acwrClassifyTrack(t) {
  // Gate dati per-binario (tempo reale + numerosità)
  if (t.count < _ACWR_MIN_SESSIONS || t.spanDays < _ACWR_MIN_SPAN_DAYS) {
    return {
      value: t.count ? t.current.toFixed(2) : null,
      level: 'insufficient', text: 'Dati insufficienti',
      color: _ACWR_COLOR.insufficient,
      z: null, baseline: null,
      note: 'Servono ~3 settimane di storico per un riferimento affidabile.',
    };
  }

  const cur = t.current;
  // Baseline personale: distribuzione dei ratio storici, saltando il warm-up iniziale
  const samples = t.ratios.slice(Math.min(3, Math.max(0, t.ratios.length - 1)));
  const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
  const variance = samples.reduce((a, b) => a + (b - mean) ** 2, 0) / samples.length;
  const sd = Math.sqrt(variance);
  const reliable = samples.length >= _ACWR_MIN_BASELINE && sd > 0.02;
  const z = reliable ? (cur - mean) / sd : null;

  let level, text, note;

  // Filosofia: l'individualizzazione RIDUCE i falsi allarmi, non ne crea.
  // La fascia sicura (0.8–1.3) è sempre "nella norma"; lo z-score interviene
  // solo SOPRA 1.3 per decidere se il carico alto è tollerato dall'atleta o no.
  if (cur < 0.8) {
    // Sotto la fascia: informativo, non un warning (detraining/scarico)
    level = 'low';
    text  = 'Carico in calo';
    note  = 'Sotto la fascia abituale — possibile scarico o detraining.';
  } else if (cur <= 1.3) {
    level = 'optimal';
    text  = reliable ? 'In linea col suo standard' : 'Nella norma';
    note  = 'Nella fascia di carico sicura (0.8–1.3).';
  } else if (reliable) {
    // Sopra 1.3: individualizzato sul baseline personale
    if (z >= 2 || cur > 2.0)      { level = 'high';     text = 'Molto sopra il suo standard — verifica'; }
    else if (z >= 1 || cur > 1.5) { level = 'elevated'; text = 'Sopra il suo standard'; }
    else                          { level = 'optimal';  text = 'Alto ma nella sua norma'; }
    note = level === 'optimal'
      ? `Alto in assoluto ma in linea col suo standard (~${mean.toFixed(2)}).`
      : `Standard personale ~${mean.toFixed(2)} · ${z >= 0 ? '+' : ''}${z.toFixed(1)}σ sopra la sua media.`;
  } else {
    // Poco storico: soglie generiche, etichette oneste (niente "DANGER")
    if (cur > 1.5)  { level = 'high';     text = 'Carico in forte aumento — verifica'; }
    else            { level = 'elevated'; text = 'Carico in aumento'; }
    note = 'Soglie generiche (storico personale ancora breve).';
  }

  return { value: cur.toFixed(2), level, text, color: _ACWR_COLOR[level], z: z != null ? +z.toFixed(2) : null, baseline: reliable ? +mean.toFixed(2) : null, note };
}

export function calculateACWR(athId) {
  // Copia difensiva — non muta mai l'array globale durante l'iterazione
  const s = [...DB.sessions]
  .filter(x => x.athlete === athId)
  .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // EWMA PER-SESSIONE (non giornaliera). Nota tecnica: una decadenza su
  // calendario giorno-per-giorno (Williams et al.) è stata valutata e scartata
  // per questo dominio — con l'allenamento di forza sparso (2-4 sedute/sett.)
  // i giorni di riposo fanno "schizzare" l'acuto nel giorno-seduta e generano
  // falsi picchi. L'EWMA per-sessione media più sedute ed è più robusta qui.
  // Il "non si allena da giorni" è coperto dal motore di adozione.
  const alphaAcute = 0.33, alphaChronic = 0.05;
  const walkTrack = (rows, loadFn) => {
    let a = 0, c = 0, seeded = false;
    const ratios = [];
    rows.forEach(row => {
      const x = loadFn(row) || 0;
      if (!seeded) { a = x; c = x; seeded = true; }
      else {
        a = (alphaAcute * x) + ((1 - alphaAcute) * a);
        c = (alphaChronic * x) + ((1 - alphaChronic) * c);
      }
      if (c > 0) ratios.push(a / c);
    });
    const spanDays = rows.length
      ? (new Date(rows[rows.length - 1].date).getTime() - new Date(rows[0].date).getTime()) / 86400000
      : 0;
    return { count: rows.length, spanDays, ratios, current: ratios.length ? ratios[ratios.length - 1] : 0 };
  };

  const gym   = walkTrack(s.filter(x => x.sessionType === 'Palestra'), r => r.vol);
  const field = walkTrack(s.filter(x => x.sessionType !== 'Palestra'), r => r.sRPE);

  return { gym: _acwrClassifyTrack(gym), field: _acwrClassifyTrack(field) };
}


// ─────────────────────────────────────────────────────────────
// 2. window.renderE1rmChart(sessionFilter, exerciseFilter)
// Grafico line — Evoluzione del picco e1RM settimana per
// settimana, filtrata per sessione e opzionalmente per esercizio.
// Stato vuoto premium: messaggio inline centrato sul canvas.
// Gradient fill verde OLED dal 40% all'0% di opacità.
// ─────────────────────────────────────────────────────────────
export function renderE1rmChart(sessionFilter, exerciseFilter) {
  const ctxE1rm = document.getElementById('chart-e1rm');
  const container = ctxE1rm ? ctxE1rm.parentElement : null;
  if (!ctxE1rm || !container) return;

  let sess = DB.sessions.filter(s => s.athlete === appState.selAthId);
  if (sessionFilter) {
  sess = sess.filter(s => s.session === sessionFilter);
  }

  let validSess;
  if (exerciseFilter) {
  validSess = sess.filter(s => s.e1rmPerExercise && (s.e1rmPerExercise[exerciseFilter] || 0) > 0);
  } else {
  validSess = sess.filter(s => s.maxE1rm > 0);
  }

  // ── Stato vuoto ──────────────────────────────────────────
  if (validSess.length === 0) {
  ctxE1rm.style.display = 'none';
  let oldMsg = document.getElementById('e1rm-empty-msg');
  if (oldMsg) oldMsg.remove();

  const msg = document.createElement('div');
  msg.id = 'e1rm-empty-msg';
  msg.style.cssText = 'position:absolute; inset:0; display:flex; align-items:center; justify-content:center;'
  + 'color:var(--muted); font-size:12px; text-align:center; padding:20px; line-height:1.6;';
  msg.innerHTML = '<span style="font-size:24px; margin-bottom:8px; display:block;"></span>'
  + 'Nessun massimale registrato.<br>Completa il tuo primo allenamento per sbloccare le analisi di forza.';
  container.appendChild(msg);

  const subtitleEl = document.getElementById('e1rm-chart-subtitle');
  if (subtitleEl && exerciseFilter) {
  subtitleEl.textContent = `Nessun dato storico per: ${exerciseFilter}`;
  }
  return;
  }

  // ── Dati presenti: mostra il grafico ────────────────────
  ctxE1rm.style.display = 'block';
  const oldMsg = document.getElementById('e1rm-empty-msg');
  if (oldMsg) oldMsg.remove();

  // Picco massimo per settimana (cronologico)
  const cronoSess = [...validSess].sort((a, b) => new Date(a.date) - new Date(b.date));
  const weeks = [...new Set(cronoSess.map(s => s.week))].sort((a, b) => a - b);
  const e1rmMappa = {};
  weeks.forEach(w => { e1rmMappa[w] = 0; });
  cronoSess.forEach(s => {
  const val = exerciseFilter
  ? ((s.e1rmPerExercise && s.e1rmPerExercise[exerciseFilter]) || 0)
  : (s.maxE1rm || 0);
  if (s.week && val > e1rmMappa[s.week]) e1rmMappa[s.week] = val;
  });

  const chartLabels = weeks.map(w => `Settimana ${w}`);
  const chartDataValues = weeks.map(w => e1rmMappa[w] || 0);

  const datasetLabel = exerciseFilter
  ? `${exerciseFilter} — e1RM (kg)`
  : (sessionFilter ? `${sessionFilter} — e1RM Max (kg)` : 'Massimale Stimato (e1RM kg)');

  if (e1rmChartInstance) e1rmChartInstance.destroy();

  const _opts = axChartOptions();
  Object.assign(_opts.scales.y, axHonestRange(chartDataValues));
  _opts.scales.y.ticks.callback = v => v + ' kg';
  _opts.plugins.tooltip.callbacks = { label: c => `${c.parsed.y} kg e1RM` };

  e1rmChartInstance = new Chart(ctxE1rm, {
  type: 'line',
  data: {
  labels: chartLabels,
  datasets: [{
  label: datasetLabel,
  data: chartDataValues,
  borderColor: AX.accent,
  backgroundColor: axAreaFill(0.34),
  borderWidth: 2.5,
  pointBackgroundColor: AX.accentHi,
  pointBorderColor: AX.bg,
  pointBorderWidth: 2.5,
  pointRadius: axLastPointOnly(chartDataValues.length, 5.5),
  pointHoverRadius: 6,
  tension: 0.35,
  cubicInterpolationMode: 'monotone',
  fill: true
  }]
  },
  options: _opts
  });

  // Aggiorna il sottotitolo dinamicamente
  const subtitleEl = document.getElementById('e1rm-chart-subtitle');
  if (subtitleEl) {
  subtitleEl.textContent = exerciseFilter
  ? `Andamento e1RM — ${exerciseFilter} (${sessionFilter || 'tutte le sessioni'})`
  : (sessionFilter
  ? `Sessione: ${sessionFilter} — picco e1RM per settimana`
  : 'Picco massimo e1RM registrato settimana per settimana.');
  }
}


// ─────────────────────────────────────────────────────────────
// 3. window.renderAnalytics()
// Orchestratore principale del pannello Analytics.
// Chiama in sequenza tutti i sotto-motori di calcolo e
// rendering. Non accetta argomenti: legge appState.selAthId e DB
// dallo stato globale.
// ─────────────────────────────────────────────────────────────
export function renderAnalytics() {
  const ath = athById(appState.selAthId);
  const sess = DB.sessions.filter(s => s.athlete === appState.selAthId);

  // ── a) Sottotitolo + body composition + test DB ─────────
  document.getElementById('an-sub').textContent =
  ath ? `${ath.name} · ${sess.length} sessioni` : '';

  renderBodyComp(ath);
  renderTestDB(ath);

  // ── b) Inietta il wrapper del Radar (DOM dinamico) ───────
  const radarWrapper = document.getElementById('radar-wrapper');
  if (radarWrapper) {
  radarWrapper.innerHTML = `
  <div class="card" id="radar-container"
  style="margin-bottom:12px; margin-top:12px; position:relative;">
  <div class="card-t" style="text-align:center;">
  Profilo Biologico (Stato Attuale vs Picco Storico)
  </div>
  <div id="radar-charts-area" style="display:flex; gap:8px; justify-content:space-around; flex-wrap:wrap;">
  <div style="flex:1; text-align:center; min-width:150px;">
  <div style="font-size:9px; color:var(--teal); font-weight:800;
  text-transform:uppercase; letter-spacing:1px; margin-bottom:4px;">
  Recupero &amp; SNC
  </div>
  <div style="position:relative; height:220px;">
  <canvas id="chart-radar-recovery"></canvas>
  </div>
  </div>
  <div style="flex:1; text-align:center; min-width:150px;">
  <div style="font-size:9px; color:var(--amber); font-weight:800;
  text-transform:uppercase; letter-spacing:1px; margin-bottom:4px;">
  Performance
  </div>
  <div style="position:relative; height:220px;">
  <canvas id="chart-radar-performance"></canvas>
  </div>
  </div>
  </div>
  <div id="radar-placeholder"
  style="display:none; align-items:center; justify-content:center;
  color:var(--muted); font-size:11px; text-align:center;
  line-height:1.5; padding:20px; min-height:160px;"></div>
  </div>`;
  }

  // ── Dati aggregati per settimana ─────────────────────────
  const weeks = [...new Set(sess.map(s => s.week))].sort((a, b) => a - b);

  // Settimane con almeno 2 sessioni — evita crolli falsi nei grafici di volume
  const validWeeks = weeks.filter(w => sess.filter(s => s.week === w).length >= 2);

  // ── c) SPARK CARDS — Volume / sRPE / e1RM ───────────────
  const metrics = [
  { key: 'vol', label: 'Volume (t)', fmt: v => (v / 1000).toFixed(2), color: 'var(--blue)' },
  { key: 'sRPE', label: 'Carico Interno (UA)',fmt: v => Math.round(v), color: 'var(--purple)' },
  { key: 'maxE1rm',label: 'e1RM Max (kg)', fmt: v => Math.round(v), color: 'var(--teal)' }
  ];

  const sw = document.getElementById('an-sparks');
  sw.innerHTML = '';

  metrics.forEach(m => {
  // Media per settimana — usa validWeeks per vol/sRPE, tutte le settimane per e1RM
  const sparkWeeks = m.key === 'maxE1rm' ? weeks : validWeeks;
  const vals = sparkWeeks.map(w => {
  const ws = sess.filter(s => s.week === w);
  return ws.length ? ws.reduce((a, s) => a + (s[m.key] || 0), 0) / ws.length : 0;
  });
  const maxV = Math.max(...vals, 0.01);
  const cur = vals[vals.length - 1] || 0;

  const card = document.createElement('div');
  card.className = 'spark-card';
  card.innerHTML = `
  <div class="spark-t">${m.label}</div>
  <div class="spark-v" style="color:${m.color}">${m.fmt(cur)}</div>
  <div class="spark-bars"></div>
  <div class="spark-wlbls">
  ${sparkWeeks.map(w => `<div class="swl">W${w}</div>`).join('')}
  </div>`;
  sw.appendChild(card);

  // Mini barre proporzionali
  const be = card.querySelector('.spark-bars');
  vals.forEach(v => {
  const b = document.createElement('div');
  b.className = 'sb';
  b.style.cssText = `height:${Math.round((v / maxV) * 42) + 3}px;`
  + `background:${m.color}; opacity:.8`;
  be.appendChild(b);
  });
  });

  // ── d) LSI — Limb Symmetry Index ─────────────────────────
  const ii = document.getElementById('an-insights');

  // Ultima sessione con forza unilaterale registrata
  const lastUniSess = [...sess].reverse().find(s => s.e1rmDom > 0 && s.e1rmNDom > 0);
  let asymHtml = '';

  if (lastUniSess) {
  const maxDom = lastUniSess.e1rmDom;
  const maxNDom = lastUniSess.e1rmNDom;
  const diff = Math.abs(maxDom - maxNDom);
  const maxVal = Math.max(maxDom, maxNDom) || 1;
  const deficitPerc = ((diff / maxVal) * 100).toFixed(1);

  let alertColor = 'var(--teal)';
  let lsiStatus = 'Simmetria Ottimale (Deficit < 10%)';
  let lsiBg = 'oklch(0.36 0.09 52)';

  if (deficitPerc > 15) {
  alertColor = 'var(--coral)';
  lsiStatus = ' RED FLAG CLINICA (Deficit > 15%)';
  lsiBg = 'oklch(0.18 0.04 22)';
  } else if (deficitPerc > 10) {
  alertColor = 'var(--amber)';
  lsiStatus = ' Asimmetria Lieve (Monitorare)';
  lsiBg = 'oklch(0.26 0.06 88)';
  }

  asymHtml = `
  <div style="margin-top:10px; background:${lsiBg}; border:1px solid ${alertColor};
  padding:12px; border-radius:8px">
  <div style="font-size:10px; color:${alertColor}; margin-bottom:6px;
  font-weight:700; text-transform:uppercase;">
  LIMB SYMMETRY INDEX (Picco di Forza)
  </div>
  <div style="display:flex; justify-content:space-between; align-items:center;">
  <div style="font-family:var(--fh); font-size:28px; color:${alertColor}; line-height:1;">
  ${deficitPerc}%
  </div>
  <div style="text-align:right;">
  <div style="font-size:11px; color:var(--text);">
  Dx/Dom: <strong style="color:var(--blue)">${maxDom}kg</strong>
  </div>
  <div style="font-size:11px; color:var(--text);">
  Sx/NDom: <strong style="color:var(--purple)">${maxNDom}kg</strong>
  </div>
  </div>
  </div>
  <div style="font-size:11px; color:${alertColor}; margin-top:8px; font-weight:700;">
  ${lsiStatus}
  </div>
  </div>`;
  } else {
  asymHtml = `
  <div style="margin-top:10px; background:var(--s2); border:1px dashed var(--border);
  padding:10px; border-radius:8px; font-size:11px; color:var(--muted); text-align:center;">
  Dati forza unilaterale insufficienti per calcolo LSI.
  </div>`;
  }

  // ── e) ACWR Insight Box ───────────────────────────────────
  const acwrRes = calculateACWR(appState.selAthId);
  let acwrHtml = '';

  // Riga per binario: valore + etichetta individualizzata + metodologia (note)
  const acwrRow = (label, t) => `
  <div class="ins" style="border-color:${t.color}; color:${t.color}">
  <strong>${label}:</strong> ${t.value ?? '—'} — ${t.text}
  <div style="font-size:10px; color:var(--muted); font-weight:500; margin-top:3px;">${t.note}</div>
  </div>`;

  if (acwrRes) {
  acwrHtml = acwrRow('ACWR Campo (sRPE)', acwrRes.field) + acwrRow('ACWR Gym (Tonnellaggio)', acwrRes.gym)
    + `<div style="font-size:10px; color:var(--muted); margin-top:4px; font-style:italic;">
       L'ACWR è un supporto alla decisione (descrittore del trend di carico), non una predizione di infortunio.
       </div>`;
  } else {
  acwrHtml = `
  <div class="ins" style="border-color:var(--muted); color:var(--muted)">
  Dati insufficienti per il calcolo ACWR.
  </div>`;
  }

  // ── f) INDICI DI FOSTER — Monotonia e Strain ─────────────
  // Calcolati sull'ultima settimana con almeno 2 sessioni
  // con sRPE registrato.
  //
  // Monotonia = μ(carico) / σ(carico)
  // Strain = Σ(carichi settimana) × Monotonia
  //
  // Soglie cliniche:
  // < 1.5 → Variazione ottimale (DUP efficace)
  // ≥ 1.5 → Rischio monotonia (scarico necessario)
  // ≥ 2.0 → ALLERTA monotonia eccessiva
  const lastWeek = weeks.length > 0 ? weeks[weeks.length - 1] : null;
  let fosterHtml = `
  <div style="margin-top:10px; background:var(--s2); border:1px dashed var(--border);
  padding:10px; border-radius:8px; font-size:11px; color:var(--muted); text-align:center;">
  Dati insufficienti per Indici di Foster. Servono almeno 2 sedute nella stessa settimana.
  </div>`;

  if (lastWeek !== null) {
  const lastWeekSess = sess.filter(s => s.week === lastWeek && s.sRPE > 0);

  if (lastWeekSess.length > 1) {
  const loads = lastWeekSess.map(s => s.sRPE);
  const sumLoad = loads.reduce((a, b) => a + b, 0);
  const avgLoad = sumLoad / loads.length;
  const variance = loads.reduce((a, b) => a + Math.pow(b - avgLoad, 2), 0) / loads.length;
  const stdDev = Math.sqrt(variance);

  // Se la deviazione standard è troppo bassa (<5 UA) il carico è piatto → monotonia alta
  const monotony = stdDev > 5 ? (avgLoad / stdDev) : 3.0;
  const strain = sumLoad * monotony;

  let mColor = 'var(--teal)';
  let mStatus = 'Variazione Ottimale (DUP Efficace)';
  let mBg = 'oklch(0.36 0.09 52)';

  if (monotony >= 2.0) {
  mColor = 'var(--coral)';
  mStatus = ' ALLERTA: Monotonia Eccessiva (>2.0)';
  mBg = 'oklch(0.18 0.04 22)';
  } else if (monotony >= 1.5) {
  mColor = 'var(--amber)';
  mStatus = ' Rischio Monotonia (Scarico Necessario)';
  mBg = 'oklch(0.26 0.06 88)';
  }

  fosterHtml = `
  <div style="margin-top:10px; background:${mBg}; border:1px solid ${mColor};
  padding:12px; border-radius:8px">
  <div style="font-size:10px; color:${mColor}; margin-bottom:6px;
  font-weight:700; text-transform:uppercase;">
  INDICI DI FOSTER (Settimana ${lastWeek})
  </div>
  <div style="display:flex; justify-content:space-between; align-items:center;">
  <div>
  <div style="font-family:var(--fh); font-size:24px; color:${mColor}; line-height:1;">
  ${monotony.toFixed(2)}
  </div>
  <div style="font-size:10px; color:var(--text); opacity:0.8;">Indice Monotonia</div>
  </div>
  <div style="text-align:right;">
  <div style="font-family:var(--fh); font-size:20px; color:var(--purple); line-height:1;">
  ${Math.round(strain)}
  </div>
  <div style="font-size:10px; color:var(--text); opacity:0.8;">Strain (Stress Totale)</div>
  </div>
  </div>
  <div style="font-size:11px; color:${mColor}; margin-top:8px; font-weight:700;">
  ${mStatus}
  </div>
  </div>`;
  }
  }

  // Assembla tutti i blocchi di insight
  ii.innerHTML = acwrHtml + asymHtml + fosterHtml;

  // ── g) SCATTER HRV vs Performance ─────────────────────────
  // Requisito minimo: 3 sessioni con HRV > 0 e maxE1rm > 0.
  // Nasconde la card se i dati sono insufficienti.
  const ctxHrv = document.getElementById('chart-hrv-perf');
  const cardHrv = document.getElementById('card-hrv-perf');

  if (ctxHrv && cardHrv) {
  const validData = sess.filter(s => s.hrv > 0 && s.maxE1rm > 0);

  if (validData.length >= 10) {
  cardHrv.style.display = 'block';

  // Regressione lineare semplice: y = a + b*x
  const n = validData.length;
  const sumX = validData.reduce((s, p) => s + p.hrv, 0);
  const sumY = validData.reduce((s, p) => s + p.maxE1rm, 0);
  const sumXY = validData.reduce((s, p) => s + p.hrv * p.maxE1rm, 0);
  const sumX2 = validData.reduce((s, p) => s + p.hrv * p.hrv, 0);
  const denom = n * sumX2 - sumX * sumX;
  const b = denom !== 0 ? (n * sumXY - sumX * sumY) / denom : 0;
  const a = (sumY - b * sumX) / n;

  // r²
  const yMean = sumY / n;
  const ssTot = validData.reduce((s, p) => s + Math.pow(p.maxE1rm - yMean, 2), 0);
  const ssRes = validData.reduce((s, p) => s + Math.pow(p.maxE1rm - (a + b * p.hrv), 2), 0);
  const r2 = ssTot > 0 ? Math.max(0, 1 - ssRes / ssTot) : 0;

  const minX = Math.min(...validData.map(p => p.hrv));
  const maxX = Math.max(...validData.map(p => p.hrv));
  const trendData = [{ x: minX, y: a + b * minX }, { x: maxX, y: a + b * maxX }];

  const scatterData = validData.map(s => ({ x: s.hrv, y: s.maxE1rm }));

  if (hrvPerfChart) hrvPerfChart.destroy();
  hrvPerfChart = new Chart(ctxHrv, {
  type: 'scatter',
  data: {
  datasets: [
  {
  label: 'HRV vs e1RM',
  data: scatterData,
  backgroundColor: 'oklch(0.76 0.16 52 / .75)',
  borderColor: 'oklch(0.68 0.16 48)',
  pointRadius: 6,
  pointHoverRadius:8
  },
  {
  type: 'line',
  label: 'Trendline',
  data: trendData,
  borderColor: 'oklch(0.82 0.13 88 / .85)',
  borderWidth: 2,
  borderDash: [5, 4],
  pointRadius: 0,
  fill: false
  }
  ]
  },
  options: {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
  legend: { display: false },
  tooltip: {
  backgroundColor: 'rgba(12,15,19,0.95)',
  titleFont: { family: "'IBM Plex Mono', monospace", size: 11 },
  bodyFont: { family: "'IBM Plex Mono', monospace", size: 10 },
  padding: 10,
  cornerRadius: 6,
  filter: item => item.datasetIndex === 0,
  callbacks: {
  footer: () => [`r² = ${r2.toFixed(3)}`]
  }
  }
  },
  scales: {
  x: {
  title: { display: true, text: 'HRV pre-sessione (ms)', color: '#5E6873', font: { size: 9, family: "'IBM Plex Mono', monospace" } },
  grid: { color: 'rgba(255,255,255,0.05)' },
  ticks: { color: '#5E6873', font: { size: 9, family: "'IBM Plex Mono', monospace" } }
  },
  y: {
  title: { display: true, text: 'Picco e1RM (kg)', color: '#5E6873', font: { size: 9, family: "'IBM Plex Mono', monospace" } },
  grid: { color: 'rgba(255,255,255,0.05)' },
  ticks: { color: '#5E6873', font: { size: 9, family: "'IBM Plex Mono', monospace" } }
  }
  }
  }
  });
  } else {
  cardHrv.style.display = 'none';
  }
  }

  // ── h) RADAR CHART — Profilo Biologico (due istanze) ─────
  // radarRecovery → Readiness, HRV, SNC (Tap)
  // radarPerformance → Forza Max, Cap. Lavoro, LSI
  //
  // HRV baseline = media mobile degli ultimi 30 giorni via
  // getRollingHrvTrend (fallback 65 ms se storico assente).
  const ctxRecovery = document.getElementById('chart-radar-recovery');
  const ctxPerf = document.getElementById('chart-radar-performance');
  const radarPlaceholder = document.getElementById('radar-placeholder');
  const radarChartsArea = document.getElementById('radar-charts-area');

  if (ctxRecovery && ctxPerf && radarPlaceholder && radarChartsArea) {
  if (sess.length < 2) {
  radarChartsArea.style.display = 'none';
  radarPlaceholder.style.display = 'flex';
  radarPlaceholder.innerHTML =
  ` <strong style="color:var(--teal)">Raccogliendo dati biomeccanici...</strong><br>`
  + `Il profilo biologico a ragnatela richiede almeno 2 sessioni registrate `
  + `nello storico dell'atleta per tracciare i picchi prestazionali.`;
  } else {
  radarChartsArea.style.display = 'flex';
  radarPlaceholder.style.display = 'none';

  // HRV baseline dinamica: media ultimi 30 giorni
  const hrvTrend = getRollingHrvTrend(appState.selAthId, 30);
  const hrvBaseline = hrvTrend.length > 0
  ? parseFloat((hrvTrend.reduce((s, p) => s + p.hrv, 0) / hrvTrend.length).toFixed(1))
  : 65;

  const maxE1rmHistory = Math.max(...sess.map(s => s.maxE1rm), 1);
  const maxVolHistory = Math.max(...sess.map(s => s.vol), 1);
  const cnsRecord = ath.cnsRecord || 45;

  const lastSess = sess[sess.length - 1];
  const currReadiness = DB.wellness.readinessScore || 0;
  const currCNS = DB.wellness.cnsScore || cnsRecord;
  const currHRV = DB.wellness.hrv || hrvBaseline;

  const scoreForza = Math.min((lastSess.maxE1rm / maxE1rmHistory) * 100, 100) || 0;
  const scoreLavoro = Math.min((lastSess.vol / maxVolHistory) * 100, 100) || 0;
  const scoreReadiness = currReadiness;
  const scoreCNS = Math.min((currCNS / cnsRecord) * 100, 100);
  const scoreHRV = Math.min((currHRV / hrvBaseline) * 100, 100);

  let scoreSimmetria = 100;
  if (lastUniSess) {
  const maxD = lastUniSess.e1rmDom;
  const maxND = lastUniSess.e1rmNDom;
  const diff = Math.abs(maxD - maxND);
  const maxV = Math.max(maxD, maxND) || 1;
  scoreSimmetria = Math.max(100 - (diff / maxV) * 100, 0);
  }

  const sharedRadarOpts = {
  responsive: true,
  maintainAspectRatio: false,
  scales: {
  r: {
  angleLines: { color: 'rgba(255,255,255,0.07)' },
  grid: { color: 'rgba(255,255,255,0.07)' },
  pointLabels: { color: '#8A939E', font: { size: 9, family: "'IBM Plex Mono', monospace", weight: '500' } },
  ticks: { display: false, min: 0, max: 100 }
  }
  },
  plugins: { legend: { display: false } }
  };

  if (window.radarRecovery) window.radarRecovery.destroy();
  window.radarRecovery = new Chart(ctxRecovery, {
  type: 'radar',
  data: {
  labels: ['Readiness', 'HRV', 'SNC (Tap)'],
  datasets: [{
  label: 'Recupero',
  data: [scoreReadiness, scoreHRV, scoreCNS],
  backgroundColor: 'oklch(0.72 0.16 52 / .16)',
  borderColor: 'oklch(0.76 0.16 52)',
  pointBackgroundColor: 'oklch(0.80 0.15 52)',
  pointBorderColor: 'transparent',
  pointRadius: 3.2,
  borderWidth: 2
  }]
  },
  options: sharedRadarOpts
  });

  if (window.radarPerformance) window.radarPerformance.destroy();
  window.radarPerformance = new Chart(ctxPerf, {
  type: 'radar',
  data: {
  labels: ['Forza Max', 'Cap. Lavoro', 'LSI'],
  datasets: [{
  label: 'Performance',
  data: [scoreForza, scoreLavoro, scoreSimmetria],
  backgroundColor: 'oklch(0.74 0.11 175 / .14)',
  borderColor: 'oklch(0.74 0.11 175)',
  pointBackgroundColor: 'oklch(0.80 0.10 175)',
  pointBorderColor: 'transparent',
  pointRadius: 3.2,
  borderWidth: 2
  }]
  },
  options: sharedRadarOpts
  });
  }
  }

  // ── j) PEAKING / TAPERING — Grafico a doppia scala ───────
  // Line (forza e1RM) + Bar (volume kg) per settimana.
  // Badge rilevamento automatico del trend:
  // Vol↓ + Int↑ → Peaking Ottimale
  // Vol↑ → Fase Accumulo
  // Altro → Transizione / Mantenimento
  const peakingWrapper = document.getElementById('peaking-wrapper');
  if (peakingWrapper) {
  peakingWrapper.innerHTML = `
  <div class="card" id="peaking-container"
  style="margin-bottom:12px; margin-top:12px; position:relative;">
  <div class="card-t" style="display:flex; justify-content:space-between; align-items:center;">
  <span>Matrice Tapering & Peaking</span>
  <span id="peaking-badge"
  style="font-size:9px; padding:3px 6px; border-radius:4px;
  font-weight:800; text-transform:uppercase;"></span>
  </div>
  <div style="position:relative; height:220px; width:100%;">
  <canvas id="chart-peaking"></canvas>
  <div id="peaking-placeholder"
  style="position:absolute; inset:0; display:none; align-items:center;
  justify-content:center; color:var(--muted); font-size:11px;
  text-align:center; line-height:1.5; padding:20px;"></div>
  </div>
  </div>`;
  }

  const ctxPeaking = document.getElementById('chart-peaking');
  const peakingPlaceholder = document.getElementById('peaking-placeholder');

  if (ctxPeaking && peakingPlaceholder) {
  // Usa validWeeks: settimane con ≥ 2 sessioni evitano crolli falsi nel volume
  const peakWeeks = validWeeks;

  if (peakWeeks.length < 2) {
  ctxPeaking.style.display = 'none';
  peakingPlaceholder.style.display = 'flex';
  peakingPlaceholder.innerHTML =
  ` <strong style="color:var(--blue)">Analisi Peaking in corso...</strong><br>`
  + `Servono almeno 2 settimane con ≥ 2 sessioni ciascuna per confrontare Volume e Intensità.`;
  document.getElementById('peaking-badge').style.display = 'none';
  } else {
  ctxPeaking.style.display = 'block';
  peakingPlaceholder.style.display = 'none';

  // Aggregazione: volume normalizzato per sessione + picco e1RM
  const weeklyVolNorm = []; // kg / sessione
  const weeklyInt = []; // e1RM max
  peakWeeks.forEach(w => {
  const wSess = sess.filter(s => s.week === w);
  const sumVol = wSess.reduce((a, b) => a + (b.vol || 0), 0);
  const maxE1rm = Math.max(...wSess.map(s => s.maxE1rm || 0), 0);
  weeklyVolNorm.push(parseFloat((sumVol / wSess.length).toFixed(0)));
  weeklyInt.push(maxE1rm);
  });

  // Badge: richiede ≥ 3 settimane consecutive con dati sufficienti
  const badge = document.getElementById('peaking-badge');

  // Controlla se le ultime 3 settimane in peakWeeks sono consecutive
  const hasThreeConsec = peakWeeks.length >= 3 &&
  peakWeeks[peakWeeks.length - 1] - peakWeeks[peakWeeks.length - 3] === 2;

  if (!hasThreeConsec) {
  badge.style.display = 'none';
  } else {
  badge.style.display = 'inline-block';
  const lastVol = weeklyVolNorm[weeklyVolNorm.length - 1];
  const prevVol = weeklyVolNorm[weeklyVolNorm.length - 2];
  const lastInt = weeklyInt[weeklyInt.length - 1];
  const prevInt = weeklyInt[weeklyInt.length - 2];

  if (lastVol < prevVol && lastInt >= prevInt && lastInt > 0) {
  badge.textContent = ' Peaking Ottimale';
  badge.style.backgroundColor = 'oklch(0.36 0.09 52)';
  badge.style.color = 'var(--teal)';
  } else if (lastVol > prevVol) {
  badge.textContent = ' Fase Accumulo';
  badge.style.backgroundColor = 'rgba(59, 130, 246, 0.2)';
  badge.style.color = 'var(--blue)';
  } else {
  badge.textContent = ' Transizione / Mantenimento';
  badge.style.backgroundColor = 'oklch(0.26 0.06 88)';
  badge.style.color = 'var(--amber)';
  }
  }

  if (window.peakingChartInstance) window.peakingChartInstance.destroy();
  window.peakingChartInstance = new Chart(ctxPeaking, {
  type: 'line',
  data: {
  labels: peakWeeks.map(w => `W${w}`),
  datasets: [
  {
  type: 'line',
  label: 'e1RM (kg)',
  data: weeklyInt,
  borderColor: 'oklch(0.82 0.13 88)',
  backgroundColor: 'oklch(0.82 0.13 88 / .08)',
  borderWidth: 2.5,
  pointRadius: 3.5,
  pointBackgroundColor: 'oklch(0.82 0.13 88)',
  yAxisID: 'y-int',
  tension: 0.3,
  fill: false
  },
  {
  type: 'bar',
  label: 'Vol. norm. (kg/sess.)',
  data: weeklyVolNorm,
  backgroundColor: 'rgba(59, 130, 246, 0.28)',
  borderColor: 'rgba(59, 130, 246, 0.7)',
  borderWidth: 1,
  borderRadius: 3,
  yAxisID: 'y-vol'
  }
  ]
  },
  options: {
  responsive: true,
  maintainAspectRatio: false,
  interaction: { mode: 'index', intersect: false },
  plugins: {
  legend: {
  display: true,
  position: 'bottom',
  labels: { color: '#5E6873', font: { size: 9, family: "'IBM Plex Mono', monospace" }, boxWidth: 12 }
  },
  tooltip: {
  backgroundColor: 'rgba(12, 15, 19, 0.95)',
  titleFont: { family: "'IBM Plex Mono', monospace", size: 11, weight: '600' },
  bodyFont: { family: "'IBM Plex Mono', monospace", size: 10 },
  padding: 10,
  cornerRadius: 6
  }
  },
  scales: {
  x: {
  grid: { display: false },
  ticks: { color: '#5E6873', font: { size: 9, family: "'IBM Plex Mono', monospace", weight: '500' } }
  },
  'y-vol': {
  type: 'linear',
  display: true,
  position: 'left',
  beginAtZero: true,
  grid: { color: 'rgba(255,255,255,0.05)' },
  ticks: { color: '#5E6873', font: { size: 9, family: "'IBM Plex Mono', monospace" } },
  title: {
  display: true,
  text: 'Vol. norm. (kg/sess.)',
  color: 'rgba(59,130,246,0.6)',
  font: { size: 9, family: "'IBM Plex Mono', monospace" }
  }
  },
  'y-int': {
  type: 'linear',
  display: true,
  position: 'right',
  suggestedMin: 20,
  grid: { drawOnChartArea: false },
  ticks: { color: '#5E6873', font: { size: 9, family: "'IBM Plex Mono', monospace" } },
  title: {
  display: true,
  text: 'e1RM (kg)',
  color: 'oklch(0.82 0.13 88 / .7)',
  font: { size: 9, family: "'IBM Plex Mono', monospace" }
  }
  }
  }
  }
  });
  }
  }

  // ── i) HRV TREND — Linea storica + Media Mobile 7 giorni ─
  const hrvTrendWrapper = document.getElementById('hrv-trend-wrapper');
  if (hrvTrendWrapper) {
  const hrvTrendData = getRollingHrvTrend(appState.selAthId, 30);

  if (hrvTrendData.length < 2) {
  hrvTrendWrapper.innerHTML = '';
  } else {
  hrvTrendWrapper.innerHTML = `
  <div class="card" style="margin-bottom:12px; margin-top:12px;">
  <div class="card-t">HRV Trend — Ultimi 30 Giorni</div>
  <div style="position:relative; height:200px; width:100%;">
  <canvas id="chart-hrv-trend"></canvas>
  </div>
  <div style="font-size:10px; color:var(--muted); margin-top:6px; text-align:center;">
  Linea sottile = HRV giornaliera &nbsp;·&nbsp; Linea tratteggiata spessa = Media mobile 7gg
  </div>
  </div>`;

  const ctxHrvTrend = document.getElementById('chart-hrv-trend');
  if (ctxHrvTrend) {
  if (window.hrvTrendChartInstance) window.hrvTrendChartInstance.destroy();

  const labels = hrvTrendData.map(p => p.date.slice(5)); // MM-DD
  const dailyVals = hrvTrendData.map(p => p.hrv);
  const rolling7d = hrvTrendData.map(p => p.rolling7d); // null nei primi 6 pt

  window.hrvTrendChartInstance = new Chart(ctxHrvTrend, {
  type: 'line',
  data: {
  labels,
  datasets: [
  {
  label: 'HRV giornaliera (ms)',
  data: dailyVals,
  borderColor: 'oklch(0.74 0.15 52)',
  backgroundColor: 'oklch(0.74 0.15 52 / .06)',
  borderWidth: 1.5,
  pointRadius: 3,
  pointBackgroundColor: 'oklch(0.76 0.16 52)',
  tension: 0.3,
  fill: true
  },
  {
  label: 'Media mobile 7gg (ms)',
  data: rolling7d,
  borderColor: '#A78BFA',
  borderWidth: 3,
  borderDash: [6, 3],
  pointRadius: 0,
  tension: 0.4,
  fill: false,
  spanGaps: false
  }
  ]
  },
  options: {
  responsive: true,
  maintainAspectRatio: false,
  interaction: { mode: 'index', intersect: false },
  plugins: {
  legend: {
  display: true,
  position: 'bottom',
  labels: { color: '#5E6873', font: { size: 9, family: "'IBM Plex Mono', monospace" }, boxWidth: 12 }
  },
  tooltip: {
  backgroundColor: 'rgba(12,15,19,0.95)',
  titleFont: { family: "'IBM Plex Mono', monospace", size: 11 },
  bodyFont: { family: "'IBM Plex Mono', monospace", size: 10 },
  padding: 10,
  cornerRadius: 6,
  callbacks: {
  label: ctx => {
  const v = ctx.parsed.y;
  return v !== null ? `${ctx.dataset.label}: ${v} ms` : null;
  }
  }
  }
  },
  scales: {
  x: {
  grid: { display: false },
  ticks: { color: '#5E6873', font: { size: 9, family: "'IBM Plex Mono', monospace" }, maxTicksLimit: 12 }
  },
  y: {
  grid: { color: 'rgba(255,255,255,0.05)' },
  ticks: { color: '#5E6873', font: { size: 9, family: "'IBM Plex Mono', monospace" } },
  title: {
  display: true,
  text: 'HRV (ms)',
  color: '#5E6873',
  font: { size: 9, family: "'IBM Plex Mono', monospace" }
  }
  }
  }
  }
  });
  }
  }
  }
}


// ─────────────────────────────────────────────────────────────
// 4. calculateEfficiencyIndex(athId)
// Rapporto settimanale tonnellaggio Gym / sRPE medio.
// Indice di efficienza meccanica: se a parità di tonnellaggio
// lo sRPE cresce, l'indice scende → fatica cumulativa crescente.
//
// Logica:
// tonnellaggio = somma vol sessioni non-Campo (s.vol, kg)
// sRPEAvg = media di tutte le sessioni con sRPE > 0
// efficiencyIndex = tonnellaggio / sRPEAvg
//
// Restituisce: array ordinato per settimana di oggetti
// { week, tonnellaggio, sRPEAvg, efficiencyIndex }
// Le settimane prive di entrambi i segnali sono escluse.
// ─────────────────────────────────────────────────────────────
export function calculateEfficiencyIndex(athId) {
  const sess = DB.sessions.filter(s => s.athlete === athId);
  const weeks = [...new Set(sess.map(s => s.week))].sort((a, b) => a - b);

  const result = [];
  weeks.forEach(w => {
  const wSess = sess.filter(s => s.week === w);
  const gymSess = wSess.filter(s => s.sessionType === 'Palestra' && s.vol > 0);
  const tonnellaggio = gymSess.reduce((sum, s) => sum + s.vol, 0);

  const srpeSess = wSess.filter(s => s.sRPE > 0);
  const sRPEAvg = srpeSess.length
  ? srpeSess.reduce((sum, s) => sum + s.sRPE, 0) / srpeSess.length
  : 0;

  if (sRPEAvg > 0 && tonnellaggio > 0) {
  result.push({
  week: w,
  tonnellaggio,
  sRPEAvg: parseFloat(sRPEAvg.toFixed(1)),
  efficiencyIndex: parseFloat((tonnellaggio / sRPEAvg).toFixed(2))
  });
  }
  });

  return result;
}


// ─────────────────────────────────────────────────────────────
// 5. calculateProgressionIndex(exName, weeks = 4)
// Analizza la serie storica dell'e1RM stimato per l'esercizio
// `exName` (source: session.e1rmPerExercise) e restituisce
// la % di incremento medio settimanale nelle ultime `weeks`
// settimane con dato disponibile.
//
// Restituisce:
// weeklyData → [{ week, e1rm }] — tutta la storia
// avgWeeklyGain → % incremento medio per settimana (può essere <0)
// totalGain → % incremento totale nel periodo considerato
// ─────────────────────────────────────────────────────────────
export function calculateProgressionIndex(exName, weeks = 4) {
  const sess = DB.sessions.filter(
  s => s.athlete === appState.selAthId &&
  s.e1rmPerExercise &&
  (s.e1rmPerExercise[exName] || 0) > 0
  );

  if (sess.length === 0) return { weeklyData: [], avgWeeklyGain: 0, totalGain: 0 };

  // Picco e1RM per settimana, in ordine cronologico
  const allWeeks = [...new Set(sess.map(s => s.week))].sort((a, b) => a - b);
  const weeklyData = allWeeks.map(w => {
  const wSess = sess.filter(s => s.week === w);
  const e1rm = Math.max(...wSess.map(s => s.e1rmPerExercise[exName]));
  return { week: w, e1rm };
  });

  // Analisi sulle ultime `weeks` settimane con dato
  const recentWeeks = weeklyData.slice(-weeks);
  if (recentWeeks.length < 2) return { weeklyData, avgWeeklyGain: 0, totalGain: 0 };

  // Incrementi settimana su settimana in percentuale
  const gains = [];
  for (let i = 1; i < recentWeeks.length; i++) {
  if (recentWeeks[i - 1].e1rm > 0) {
  gains.push(
  ((recentWeeks[i].e1rm - recentWeeks[i - 1].e1rm) / recentWeeks[i - 1].e1rm) * 100
  );
  }
  }

  const avgWeeklyGain = gains.length
  ? parseFloat((gains.reduce((a, b) => a + b, 0) / gains.length).toFixed(2))
  : 0;

  const first = recentWeeks[0].e1rm;
  const last = recentWeeks[recentWeeks.length - 1].e1rm;
  const totalGain = first > 0
  ? parseFloat(((last - first) / first * 100).toFixed(2))
  : 0;

  return { weeklyData, avgWeeklyGain, totalGain };
}


// ─────────────────────────────────────────────────────────────
// 6. getRollingHrvTrend(athId, days = 30)
// Media mobile a 7 giorni della HRV giornaliera estratta da
// DB.sessions (campo s.hrv — registrato nel Wellness Check-in
// pre-sessione). Più sessioni nello stesso giorno → media.
//
// La media mobile è trailing (finestra sugli ultimi 7 punti
// disponibili), quindi i primi 6 punti della serie hanno
// rolling7d = null.
//
// Restituisce: array ordinato per data di oggetti
// { date: 'YYYY-MM-DD', hrv: number, rolling7d: number|null }
// ─────────────────────────────────────────────────────────────
export function getRollingHrvTrend(athId, days = 30) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  cutoff.setHours(0, 0, 0, 0);

  const relevant = DB.sessions.filter(
  s => s.athlete === athId && s.hrv > 0 && new Date(s.date) >= cutoff
  );

  if (relevant.length === 0) return [];

  // Aggrega per giorno (media se più sessioni nello stesso giorno)
  const byDate = {};
  relevant.forEach(s => {
  if (!byDate[s.date]) byDate[s.date] = [];
  byDate[s.date].push(s.hrv);
  });

  const daily = Object.entries(byDate)
  .map(([date, vals]) => ({
  date,
  hrv: parseFloat((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1))
  }))
  .sort((a, b) => new Date(a.date) - new Date(b.date));

  // Media mobile a 7 giorni (trailing)
  return daily.map((point, idx) => {
  if (idx < 6) return { ...point, rolling7d: null };
  const slice7 = daily.slice(idx - 6, idx + 1);
  const avg7 = slice7.reduce((sum, p) => sum + p.hrv, 0) / 7;
  return { ...point, rolling7d: parseFloat(avg7.toFixed(1)) };
  });
}


// ─────────────────────────────────────────────────────────────
// 7. renderAthProgressi()
// Pannello "I miei progressi" — vista personale atleta.
// Legge window.mioIdLoggato (o appState.selAthId come fallback).
// ─────────────────────────────────────────────────────────────
let apE1rmChart = null;

// ACWR: 0.8–1.3 ok · 1.3–1.5 / <0.8 attenzione · >1.5 rischio
function _acwrTone(v) {
  const n = parseFloat(v);
  if (!isFinite(n)) return 'var(--text)';
  return n > 1.5 ? 'var(--bad)' : (n > 1.3 || n < 0.8) ? 'var(--warn)' : 'var(--ok)';
}

export function renderAthProgressi() {
  const athId = window.mioIdLoggato || appState.selAthId;
  const ath = athById(athId);
  const all = [...DB.sessions]
  .filter(s => s.athlete === athId)
  .sort((a, b) => a.date.localeCompare(b.date));

  const titleEl = document.getElementById('ap-title');
  const subEl = document.getElementById('ap-sub');
  if (titleEl) titleEl.textContent = ath ? `Ciao, ${ath.name.split(' ')[0]} ` : 'I miei progressi';
  if (subEl) subEl.textContent = `${all.length} sessioni registrate`;

  // ── Il mio miglior mese ──────────────────────────────────
  const now = new Date();
  const thisMoKey = now.toISOString().slice(0, 7);
  const lastMoDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMoKey = lastMoDate.toISOString().slice(0, 7);
  const thisMonthSess = all.filter(s => s.date.startsWith(thisMoKey));
  const lastMonthSess = all.filter(s => s.date.startsWith(lastMoKey));
  const monthEl = document.getElementById('ap-month');
  if (monthEl && (thisMonthSess.length || lastMonthSess.length)) {
  const freq = (ath && ath.freq) ? ath.freq : 4;
  const sch = DB.schedules?.[athId];
  const schWeeks = sch?.duration || 4;
  const thisVol = thisMonthSess.reduce((a, s) => a + (s.vol||0), 0);
  const lastVol = lastMonthSess.reduce((a, s) => a + (s.vol||0), 0);
  const volDelta = lastVol > 0 ? Math.round((thisVol-lastVol)/lastVol*100) : null;
  const volColor = volDelta === null ? 'var(--muted)' : volDelta >= 0 ? 'var(--ok)' : 'var(--bad)';
  const thisE1rm = thisMonthSess.length ? Math.max(...thisMonthSess.map(s => s.maxE1rm||0)) : 0;
  const targetSess = freq * schWeeks;
  const compliance = targetSess > 0 ? Math.min(100, Math.round(thisMonthSess.length / targetSess * 100)) : null;
  monthEl.innerHTML = `
  <div class="card">
  <div class="card-t">Il mio mese — ${now.toLocaleDateString('it-IT',{month:'long'})}</div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px 10px">
  <div>
  <div class="ax-stat-l">Volume totale</div>
  <div class="ax-stat-v" style="color:var(--accent)">${(thisVol/1000).toFixed(1)}<span style="font-size:13px;color:var(--muted)"> t</span></div>
  ${volDelta !== null ? `<div style="font-family:var(--fmono);font-size:10px;margin-top:2px;color:${volColor}">${volDelta>=0?'+':''}${volDelta}% vs mese prec.</div>` : ''}
  </div>
  <div>
  <div class="ax-stat-l">Sessioni</div>
  <div class="ax-stat-v">${thisMonthSess.length}${compliance !== null ? `<span style="font-size:12px;font-weight:500;color:${compliance>=100?'var(--ok)':'var(--muted)'}"> (${compliance}%)</span>` : ''}</div>
  </div>
  ${thisE1rm > 0 ? `
  <div>
  <div class="ax-stat-l">Miglior e1RM mese</div>
  <div class="ax-stat-v">${thisE1rm}<span style="font-size:13px;color:var(--muted)"> kg</span></div>
  </div>` : ''}
  </div>
  </div>`;
  } else if (monthEl) {
  monthEl.innerHTML = '';
  }

  // ── KPI ─────────────────────────────────────────────────
  const last5 = all.slice(-5);
  const avgRpe = last5.length
  ? (last5.reduce((a, s) => a + (s.rpe || 0), 0) / last5.length).toFixed(1) : '—';
  const bestE1rm = all.length ? Math.max(...all.map(s => s.maxE1rm || 0)) : 0;
  const bestVol = all.length ? Math.max(...all.map(s => s.vol || 0)) : 0;

  const today = new Date();
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  const mondayStr = monday.toISOString().slice(0, 10);
  const thisWeek = all.filter(s => s.date >= mondayStr);
  const freq = (ath && ath.freq) ? ath.freq : 4;

  // ── GAP 5: KPI adattivi per obiettivo atleta ─────────────
  const GOAL_KPI_CONFIG = {
  'Dimagrimento': { hideE1rm: true, primary: 'volume' },
  'Forza': { hideE1rm: false, primary: 'e1rm' },
  'Performance Atletica': { hideE1rm: false, primary: 'acwr' },
  'Riabilitazione': { hideE1rm: true, primary: 'compliance' },
  'Fitness Generale': { hideE1rm: false, primary: 'compliance' },
  };
  const goalCfg = ath?.goal ? (GOAL_KPI_CONFIG[ath.goal] || null) : null;

  // Calcola valori aggiuntivi per goal specifici
  const sch4kpi = DB.schedules?.[athId];
  const tSess = ((ath?.freq || 4) * (sch4kpi?.duration || 4));
  const compPct = tSess > 0 ? Math.min(100, Math.round(all.filter(s => {
  const mo = new Date().toISOString().slice(0,7);
  return s.date.startsWith(mo);
  }).length / tSess * 100)) : null;

  // Streak sessioni consecutive
  let streak = 0;
  const sessDesc = [...all].reverse();
  if (sessDesc.length) {
  const t = new Date(); t.setHours(0,0,0,0);
  const last = new Date(sessDesc[0].date); last.setHours(0,0,0,0);
  if (Math.floor((t - last) / 86400000) <= 1) {
  streak = 1;
  for (let k = 1; k < sessDesc.length; k++) {
  const a = new Date(sessDesc[k-1].date); a.setHours(0,0,0,0);
  const b = new Date(sessDesc[k].date); b.setHours(0,0,0,0);
  if (Math.floor((a - b) / 86400000) <= 2) streak++; else break;
  }
  }
  }

  // Volume ultimi 30 giorni
  const d30 = new Date(); d30.setDate(d30.getDate() - 30);
  const d30key = d30.toISOString().slice(0,10);
  const vol30 = all.filter(s => s.date >= d30key).reduce((a, s) => a + (s.vol || 0), 0);

  // Peso attuale (ultimo valore anthropoHistory)
  const anthro = ath?.anthropoHistory;
  const lastWeight = anthro?.length ? anthro[anthro.length - 1] : null;
  const prevWeight = anthro?.length > 1 ? anthro[anthro.length - 2] : null;
  const weightDelta = (lastWeight && prevWeight) ? (lastWeight.weight - prevWeight.weight).toFixed(1) : null;

  // ACWR (usa la funzione esistente se disponibile)
  let acwrVal = '—';
  if (typeof calculateACWR === 'function') {
  try {
  const acwrRes = calculateACWR(athId);
  if (acwrRes?.field?.value !== null && acwrRes?.field?.value !== undefined) {
  acwrVal = acwrRes.field.value;
  }
  } catch (e) { /* fallback */ }
  }

  // Ultimi 30 gg (sessioni)
  const sess30 = all.filter(s => s.date >= d30key).length;

  let kpisHtml = '';
  if (!goalCfg) {
  // Default: comportamento originale
  kpisHtml = `
  <div class="kpi"><div class="kpi-l">Sessioni totali</div><div class="kpi-v">${all.length}</div></div>
  <div class="kpi"><div class="kpi-l">Questa settimana</div>
  <div class="kpi-v" style="color:${thisWeek.length >= freq ? 'var(--ok)' : 'var(--text)'}">
  ${thisWeek.length}<span style="font-size:14px;font-weight:500;color:var(--muted)">/${freq}</span>
  </div></div>
  <div class="kpi"><div class="kpi-l">Miglior e1RM</div>
  <div class="kpi-v" style="color:var(--accent)">${bestE1rm > 0 ? bestE1rm + '<span style="font-size:14px;color:var(--muted)"> kg</span>' : '—'}</div></div>
  <div class="kpi"><div class="kpi-l">RPE medio (ult. 5)</div><div class="kpi-v">${avgRpe}</div></div>`;
  } else if (ath.goal === 'Dimagrimento') {
  const wLabel = lastWeight ? `${lastWeight.weight} kg${weightDelta !== null ? ` (${weightDelta >= 0 ? '+' : ''}${weightDelta})` : ''}` : '—';
  const wColor = weightDelta !== null ? (parseFloat(weightDelta) <= 0 ? 'var(--ok)' : 'var(--bad)') : 'var(--text)';
  kpisHtml = `
  <div class="kpi"><div class="kpi-l">Sessioni mese</div><div class="kpi-v">${all.filter(s=>s.date.startsWith(new Date().toISOString().slice(0,7))).length}</div></div>
  <div class="kpi"><div class="kpi-l">Compliance %</div>
  <div class="kpi-v" style="color:${compPct >= 80 ? 'var(--ok)' : 'var(--warn)'}">${compPct !== null ? compPct + '%' : '—'}</div></div>
  <div class="kpi"><div class="kpi-l">RPE medio (ult. 5)</div><div class="kpi-v">${avgRpe}</div></div>
  <div class="kpi"><div class="kpi-l">${lastWeight ? 'Peso attuale' : 'Volume 30gg'}</div>
  <div class="kpi-v" style="color:${lastWeight ? wColor : 'var(--text)'}">${lastWeight ? wLabel : Math.round(vol30/1000) + 't'}</div></div>`;
  } else if (ath.goal === 'Forza') {
  kpisHtml = `
  <div class="kpi"><div class="kpi-l">Miglior e1RM</div>
  <div class="kpi-v" style="color:var(--accent)">${bestE1rm > 0 ? bestE1rm + '<span style="font-size:14px;color:var(--muted)"> kg</span>' : '—'}</div></div>
  <div class="kpi"><div class="kpi-l">Sessioni totali</div><div class="kpi-v">${all.length}</div></div>
  <div class="kpi"><div class="kpi-l">Volume mese (t)</div>
  <div class="kpi-v">${(all.filter(s=>s.date.startsWith(new Date().toISOString().slice(0,7))).reduce((a,s)=>a+(s.vol||0),0)/1000).toFixed(1)}</div></div>
  <div class="kpi"><div class="kpi-l">RPE medio (ult. 5)</div><div class="kpi-v">${avgRpe}</div></div>`;
  } else if (ath.goal === 'Performance Atletica') {
  kpisHtml = `
  <div class="kpi"><div class="kpi-l">Sessioni mese</div><div class="kpi-v">${all.filter(s=>s.date.startsWith(new Date().toISOString().slice(0,7))).length}</div></div>
  <div class="kpi"><div class="kpi-l">ACWR (sRPE)</div>
  <div class="kpi-v" style="color:${_acwrTone(acwrVal)}">${acwrVal}</div></div>
  <div class="kpi"><div class="kpi-l">Volume 30gg (t)</div>
  <div class="kpi-v" style="color:var(--text)">${(vol30/1000).toFixed(1)}</div></div>
  <div class="kpi"><div class="kpi-l">RPE medio (ult. 5)</div><div class="kpi-v">${avgRpe}</div></div>`;
  } else if (ath.goal === 'Riabilitazione') {
  kpisHtml = `
  <div class="kpi"><div class="kpi-l">Sessioni completate</div><div class="kpi-v">${all.length}</div></div>
  <div class="kpi"><div class="kpi-l">Compliance %</div>
  <div class="kpi-v" style="color:${compPct >= 80 ? 'var(--ok)' : 'var(--warn)'}">${compPct !== null ? compPct + '%' : '—'}</div></div>
  <div class="kpi"><div class="kpi-l">Streak</div>
  <div class="kpi-v" style="color:${streak >= 3 ? 'var(--accent)' : 'var(--text)'}">
  ${streak}<span style="font-size:14px;font-weight:500;color:var(--muted)"> gg</span>
  </div></div>
  <div class="kpi"><div class="kpi-l">Sessioni (30gg)</div><div class="kpi-v">${sess30}</div></div>`;
  } else if (ath.goal === 'Fitness Generale') {
  kpisHtml = `
  <div class="kpi"><div class="kpi-l">Sessioni mese</div><div class="kpi-v">${all.filter(s=>s.date.startsWith(new Date().toISOString().slice(0,7))).length}</div></div>
  <div class="kpi"><div class="kpi-l">Compliance %</div>
  <div class="kpi-v" style="color:${compPct >= 80 ? 'var(--ok)' : 'var(--warn)'}">${compPct !== null ? compPct + '%' : '—'}</div></div>
  <div class="kpi"><div class="kpi-l">Volume 30gg (t)</div>
  <div class="kpi-v" style="color:var(--text)">${(vol30/1000).toFixed(1)}</div></div>
  <div class="kpi"><div class="kpi-l">Streak</div>
  <div class="kpi-v" style="color:${streak >= 3 ? 'var(--accent)' : 'var(--text)'}">
  ${streak}<span style="font-size:14px;font-weight:500;color:var(--muted)"> gg</span>
  </div></div>`;
  }

  const kpisEl = document.getElementById('ap-kpis');
  if (kpisEl) kpisEl.innerHTML = kpisHtml;

  // Mostra/nascondi grafico e1RM in base al goal
  const e1rmWrap = document.getElementById('ap-e1rm-wrap');
  const e1rmFilter = document.getElementById('ap-e1rm-filter');
  if (goalCfg?.hideE1rm) {
  if (e1rmWrap) e1rmWrap.style.display = 'none';
  if (e1rmFilter) e1rmFilter.style.display = 'none';
  } else {
  if (e1rmWrap) e1rmWrap.style.display = '';
  if (e1rmFilter) e1rmFilter.style.display = '';
  }

  // ── Questa settimana ─────────────────────────────────────
  const lastSess = all.length ? all[all.length - 1] : null;
  const daysSinceLast = lastSess
  ? Math.floor((today - new Date(lastSess.date)) / 86400000) : null;
  const pct = Math.min(thisWeek.length / freq * 100, 100);

  const weekEl = document.getElementById('ap-week');
  if (weekEl) weekEl.innerHTML = `
  <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:12px">
  <div style="font-family:var(--fmono);font-size:24px;font-weight:600;letter-spacing:-.02em;color:${thisWeek.length >= freq ? 'var(--ok)' : 'var(--text)'}">
  ${thisWeek.length}<span style="color:var(--muted);font-size:15px">/${freq}</span> <span style="font-family:var(--fm);font-size:13px;font-weight:600;color:var(--muted);letter-spacing:0">sessioni</span>
  </div>
  ${daysSinceLast !== null
  ? `<div style="font-size:12px;color:var(--muted)">${daysSinceLast === 0 ? 'Allenato oggi ✓' : daysSinceLast === 1 ? 'Ultima sessione ieri' : `Ultima sessione ${daysSinceLast}gg fa`}</div>`
  : ''}
  </div>
  <div class="ax-progress${pct >= 100 ? ' is-ok' : ''}"><i style="width:${pct}%"></i></div>
  ${thisWeek.length > 0
  ? `<div style="margin-top:10px;font-size:12px;color:var(--muted);display:flex;flex-wrap:wrap;gap:4px">
  ${thisWeek.map(s => `<span class="tag tn">${s.date.slice(5)} · ${escHtml(s.session)}</span>`).join('')}
  </div>` : ''}`;

  // ── Volume bar chart ─────────────────────────────────────
  const last8 = all.slice(-8);
  const maxVol = Math.max(...last8.map(s => s.vol || 0), 1);
  const bcEl = document.getElementById('ap-vol-bc');
  if (bcEl) {
  bcEl.innerHTML = '';
  if (last8.length === 0) {
  bcEl.innerHTML = '<div style="color:var(--muted);font-size:12px;text-align:center;padding:20px">Nessuna sessione ancora</div>';
  } else {
  last8.forEach((s, idx) => {
  const h = Math.max(4, Math.round((s.vol || 0) / maxVol * 110));
  const col = document.createElement('div');
  col.className = 'bc-col' + (idx === last8.length - 1 ? ' is-last' : '');
  col.innerHTML = `<div class="bc-val">${((s.vol || 0) / 1000).toFixed(1)}k</div>
  <div class="bc-bar" style="height:${h}px"></div>
  <div class="bc-lbl">${s.date.slice(5)}</div>`;
  bcEl.appendChild(col);
  });
  }
  }

  // ── e1RM trend line chart con selector esercizi ──────────
  const allExNames = [...new Set(
  all.flatMap(s => Object.keys(s.e1rmPerExercise || {}))
  )].filter(Boolean).sort();

  const filterEl2 = document.getElementById('ap-e1rm-filter');
  // "Tutti" unisce in una linea il massimo di esercizi DIVERSI (squat un giorno, panca il giorno dopo)
  // → finti crolli. Senza scelta salvata si parte dall'esercizio con più dati; "Tutti" resta selezionabile.
  const _exCount = {};
  all.forEach(s => Object.entries(s.e1rmPerExercise || {}).forEach(([n, v]) => { if (v > 0) _exCount[n] = (_exCount[n] || 0) + 1; }));
  const _defaultEx = Object.keys(_exCount).sort((a, b) => _exCount[b] - _exCount[a])[0] || '';
  const _savedEx = localStorage.getItem('ap_e1rm_ex');
  const savedExFilter = (_savedEx !== null && (_savedEx === '' || allExNames.includes(_savedEx))) ? _savedEx : _defaultEx;
  if (filterEl2 && allExNames.length > 0) {
  filterEl2.innerHTML = `
  <select onchange="localStorage.setItem('ap_e1rm_ex',this.value);renderAthProgressi()"
  style="width:100%">
  <option value="">Tutti gli esercizi (e1RM massimo)</option>
  ${allExNames.map(n => `<option value="${escHtml(n)}" ${savedExFilter===n?'selected':''}>${escHtml(n)}</option>`).join('')}
  </select>`;
  }

  const e1rmSess = savedExFilter
  ? all.filter(s => (s.e1rmPerExercise?.[savedExFilter] || 0) > 0).slice(-12)
  .map(s => ({ ...s, maxE1rm: s.e1rmPerExercise[savedExFilter] }))
  : all.filter(s => (s.maxE1rm || 0) > 0).slice(-12);

  if (apE1rmChart) { apE1rmChart.destroy(); apE1rmChart = null; }
  const wrapEl = document.getElementById('ap-e1rm-wrap');
  if (wrapEl) {
  if (e1rmSess.length === 0) {
  wrapEl.innerHTML = '<div style="color:var(--muted);font-size:12px;text-align:center;padding:40px">Nessun dato e1RM ancora registrato</div>';
  } else {
  wrapEl.innerHTML = '<canvas id="ap-e1rm-chart"></canvas>';
  const ctx = document.getElementById('ap-e1rm-chart');
  const _opts = axChartOptions();
  _opts.scales.y.ticks.callback = v => v + ' kg';
  Object.assign(_opts.scales.y, axHonestRange(e1rmSess.map(s => s.maxE1rm)));
  _opts.plugins.tooltip.callbacks = { label: c => `${c.parsed.y} kg e1RM` };
  apE1rmChart = new Chart(ctx, {
  type: 'line',
  data: {
  labels: e1rmSess.map(s => s.date.slice(5)),
  datasets: [{
  data: e1rmSess.map(s => s.maxE1rm),
  borderColor: AX.accent,
  backgroundColor: axAreaFill(0.34),
  borderWidth: 2.5,
  pointBackgroundColor: AX.accentHi,
  pointBorderColor: AX.bg,
  pointBorderWidth: 2.5,
  pointRadius: axLastPointOnly(e1rmSess.length, 5.5),
  pointHoverRadius: 6,
  pointHoverBackgroundColor: AX.accentHi,
  tension: 0.35,
  cubicInterpolationMode: 'monotone',
  fill: true
  }]
  },
  options: _opts
  });
  let _note = document.getElementById('ap-e1rm-note');
  if (!_note) { _note = document.createElement('div'); _note.id = 'ap-e1rm-note'; _note.className = 'ax-chart-note'; wrapEl.after(_note); }
  _note.style.display = wrapEl.style.display;
  _note.textContent = savedExFilter ? `${savedExFilter} · e1RM per seduta` : 'Massimo e1RM per seduta (esercizi misti)';
  }
  }

  // ── Body composition mini ─────────────────────────────────
  const bodcompEl = document.getElementById('ap-bodcomp');
  if (bodcompEl) {
  const history = (ath?.anthropoHistory?.length >= 2)
  ? [...ath.anthropoHistory].sort((a, b) => a.date.localeCompare(b.date)).slice(-3)
  : [];
  if (history.length >= 2) {
  const last = history[history.length - 1];
  const first = history[0];
  const wDelta = last.weight && first.weight ? (last.weight - first.weight).toFixed(1) : null;
  const bfDelta = last.bf && first.bf ? (last.bf - first.bf).toFixed(1) : null;
  bodcompEl.innerHTML = `
  <div class="card" style="border:1px solid var(--border)">
  <div class="card-t">Composizione corporea</div>
  <div style="display:flex;gap:10px;flex-wrap:wrap">
  ${history.map(m => `
  <div style="flex:1;min-width:80px;text-align:center;padding:8px;background:var(--s2);border-radius:8px">
  <div style="font-size:10px;color:var(--muted)">${m.date?.slice(5) || '—'}</div>
  ${m.weight ? `<div style="font-size:14px;font-weight:700;color:var(--text)">${m.weight}kg</div>` : ''}
  ${m.bf ? `<div style="font-size:12px;color:var(--muted)">${m.bf}%BF</div>` : ''}
  </div>`).join('')}
  </div>
  <div style="margin-top:8px;font-size:11px;color:var(--muted);display:flex;gap:12px">
  ${wDelta !== null ? `<span>Peso <strong style="color:${parseFloat(wDelta)<0?'var(--ok)':'var(--bad)'}">${parseFloat(wDelta)>=0?'+':''}${wDelta}kg</strong></span>` : ''}
  ${bfDelta !== null ? `<span>BF% <strong style="color:${parseFloat(bfDelta)<0?'var(--ok)':'var(--bad)'}">${parseFloat(bfDelta)>=0?'+':''}${bfDelta}%</strong></span>` : ''}
  </div>
  </div>`;
  } else {
  bodcompEl.innerHTML = '';
  }
  }

  // ── Nutrition card ────────────────────────────────────────
  renderNutritionCard(athId);

  // ── Badge / Trofei ────────────────────────────────────────
  // Bacheca trofei atleta (riattivata 2026-09-19 — engagement/gamification).
  renderBadgesSection('ap-badges', athId);

  // ── Personal Records arricchiti ───────────────────────────
  const bestE1rmSess = all.filter(s => s.maxE1rm > 0).sort((a,b) => b.maxE1rm - a.maxE1rm)[0];
  const bestVolSess = all.filter(s => s.vol > 0).sort((a,b) => b.vol - a.vol)[0];
  const recEl = document.getElementById('ap-records');
  if (recEl) recEl.innerHTML = [
  {
  label: 'Miglior e1RM', value: bestE1rm > 0 ? `${bestE1rm} kg` : '—', color: 'var(--accent)',
  sub: bestE1rmSess ? `${bestE1rmSess.date} · ${escHtml(bestE1rmSess.session)}` : ''
  },
  {
  label: 'Volume record', value: bestVol > 0 ? `${(bestVol/1000).toFixed(1)} t` : '—', color: 'var(--text)',
  sub: bestVolSess ? `${bestVolSess.date} · ${escHtml(bestVolSess.session)}` : ''
  },
  {
  label: 'Sessioni totali', value: all.length, color: 'var(--text)', sub: ''
  },
  ].map(r => `
  <div class="ax-rec">
  <div>
  <div style="font-size:13px;color:var(--text2)">${r.label}</div>
  ${r.sub ? `<div style="font-family:var(--fmono);font-size:10px;color:var(--dim2);margin-top:3px">${r.sub}</div>` : ''}
  </div>
  <span class="ax-rec-v" style="color:${r.color}">${r.value}</span>
  </div>`).join('');
}

// ─────────────────────────────────────────────────────────────
// renderBodyComp(ath)
// Renderizza KPI, grafico dual-line e storico misurazioni
// nel card "Composizione Corporea" del pannello Analytics.
// ─────────────────────────────────────────────────────────────
export function renderBodyComp(ath) {
  const kpisEl = document.getElementById('an-bc-kpis');
  const histEl = document.getElementById('an-bc-history');
  const canvas = document.getElementById('an-bc-chart');
  if (!kpisEl || !histEl || !canvas) return;

  const history = (ath && ath.anthropoHistory && ath.anthropoHistory.length)
  ? [...ath.anthropoHistory].sort((a, b) => a.date.localeCompare(b.date))
  : [];

  // ── Stato vuoto ──────────────────────────────────────────
  if (history.length === 0) {
  kpisEl.innerHTML = '<div style="color:var(--muted);font-size:12px;grid-column:1/-1;text-align:center;padding:8px 0;">Nessuna misurazione registrata.</div>';
  canvas.style.display = 'none';
  histEl.innerHTML = '';
  return;
  }

  canvas.style.display = 'block';
  const last = history[history.length - 1];
  const prev = history.length > 1 ? history[history.length - 2] : null;

  const fmt = (v, decimals = 1) => v != null && !isNaN(v) ? Number(v).toFixed(decimals) : '—';
  const delta = (curr, prv, unit = '') => {
  if (prv == null || isNaN(curr) || isNaN(prv)) return '';
  const d = (parseFloat(curr) - parseFloat(prv)).toFixed(1);
  const col = d > 0 ? 'var(--coral)' : d < 0 ? 'var(--teal)' : 'var(--muted)';
  return `<span style="font-size:10px;color:${col};font-weight:700;">${d > 0 ? '+' : ''}${d}${unit}</span>`;
  };

  const leanMass = (last.weight && last.bf != null) ? (last.weight * (1 - last.bf / 100)) : null;
  const prevLean = (prev && prev.weight && prev.bf != null) ? (prev.weight * (1 - prev.bf / 100)) : null;

  kpisEl.innerHTML = [
  { label: 'Peso', value: fmt(last.weight) + ' kg', d: delta(last.weight, prev?.weight, 'kg') },
  { label: 'BF%', value: fmt(last.bf) + '%', d: delta(last.bf, prev?.bf, '%') },
  { label: 'Massa magra', value: leanMass ? fmt(leanMass) + ' kg' : '—', d: delta(leanMass, prevLean, 'kg') },
  ].map(k => `
  <div style="background:var(--s1);border-radius:8px;padding:10px;text-align:center;">
  <div style="font-size:10px;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">${k.label}</div>
  <div style="font-size:18px;font-weight:800;color:var(--text);">${k.value}</div>
  <div style="min-height:14px;margin-top:2px;">${k.d}</div>
  </div>`).join('');

  // ── Grafico dual-line ────────────────────────────────────
  if (bodyCompChart) { bodyCompChart.destroy(); bodyCompChart = null; }

  const labels = history.map(h => h.date.slice(5));
  const weights = history.map(h => parseFloat(h.weight) || null);
  const bfValues = history.map(h => (h.bf != null && h.bf !== '') ? parseFloat(h.bf) : null);
  const hasBf = bfValues.some(v => v != null);

  const datasets = [
  {
  label: 'Peso (kg)',
  data: weights,
  borderColor: '#10b981',
  backgroundColor: 'rgba(16,185,129,0.1)',
  tension: 0.3,
  pointRadius: 4,
  pointBackgroundColor: '#10b981',
  fill: true,
  yAxisID: 'y',
  }
  ];
  if (hasBf) {
  datasets.push({
  label: 'BF%',
  data: bfValues,
  borderColor: '#a78bfa',
  backgroundColor: 'rgba(167,139,250,0.08)',
  tension: 0.3,
  pointRadius: 4,
  pointBackgroundColor: '#a78bfa',
  fill: false,
  yAxisID: 'y2',
  });
  }

  bodyCompChart = new window.Chart(canvas, {
  type: 'line',
  data: { labels, datasets },
  options: {
  responsive: true,
  maintainAspectRatio: false,
  interaction: { mode: 'index', intersect: false },
  plugins: { legend: { labels: { color: '#5E6873', font: { size: 9, family: "'IBM Plex Mono', monospace" } } } },
  scales: {
  x: { ticks: { color: '#5E6873', font: { size: 9, family: "'IBM Plex Mono', monospace" } }, grid: { color: 'rgba(255,255,255,0.05)' } },
  y: { position: 'left', ticks: { color: '#10b981', font: { size: 9, family: "'IBM Plex Mono', monospace" } }, grid: { color: 'rgba(255,255,255,0.05)' } },
  y2: { position: 'right', display: hasBf, ticks: { color: '#a78bfa', font: { size: 9, family: "'IBM Plex Mono', monospace" } }, grid: { drawOnChartArea: false } },
  }
  }
  });

  // ── Storico misurazioni ──────────────────────────────────
  const rows = [...history].reverse().map(h => {
  const lm = (h.weight && h.bf != null) ? (h.weight * (1 - h.bf / 100)).toFixed(1) : '—';
  const sfStr = h.skinfolds && h.skinfolds.length === 3
  ? `<span style="color:var(--muted);margin-left:4px;">· Pliche: ${h.skinfolds.map(s => s + 'mm').join(' / ')}</span>` : '';
  return `<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--border);flex-wrap:wrap;gap:4px;">
  <span style="font-size:11px;color:var(--muted);">${h.date}</span>
  <span style="font-size:12px;font-weight:700;">
  <span style="color:var(--teal)">${h.weight ?? '—'}kg</span>
  ${h.bf != null && h.bf !== '' ? `<span style="color:var(--muted);margin:0 4px;">·</span><span style="color:var(--purple)">${h.bf}%BF</span>` : ''}
  <span style="color:var(--muted);margin:0 4px;">·</span><span style="color:var(--text)">M.M. ${lm}kg</span>
  ${sfStr}
  </span>
  ${h.notes ? `<span style="font-size:10px;color:var(--muted);font-style:italic;width:100%;">${escHtml(h.notes)}</span>` : ''}
  </div>`;
  }).join('');
  histEl.innerHTML = rows || '<div style="color:var(--muted);font-size:12px;padding:8px 0;">Nessun dato.</div>';
}

// ─────────────────────────────────────────────────────────────
// renderTestDB(ath)
// Mostra test raggruppati per categoria con ultimo valore,
// delta colorato, count. Click su una riga → grafico tendenza.
// ─────────────────────────────────────────────────────────────
const _CAT_COLORS = {
  'Velocità':'#F59E0B', 'Potenza':'#EF4444', 'Agilità':'#8B5CF6',
  'Resistenza':'#3B82F6', 'Forza':'#10B981', 'Mobilità':'#F97316', 'Personalizzato':'#6B7280'
};
let _testActiveCat = 'Tutti';

export function renderTestDB(ath) {
  const listEl = document.getElementById('an-test-list');
  const catsEl = document.getElementById('an-test-cats');
  if (!listEl || !catsEl) return;

  const history = (ath && ath.testHistory) ? [...ath.testHistory].sort((a,b) => a.date.localeCompare(b.date)) : [];

  if (history.length === 0) {
  catsEl.innerHTML = '';
  listEl.innerHTML = '<div style="color:var(--muted);font-size:12px;text-align:center;padding:12px 0;">Nessun test registrato.</div>';
  return;
  }

  // Raggruppa per nome test
  const byTest = {};
  history.forEach(e => {
  if (!byTest[e.test]) byTest[e.test] = { cat: e.category, unit: e.unit, lib: e.lowerIsBetter, entries: [] };
  byTest[e.test].entries.push(e);
  });

  // Categorie presenti
  const cats = ['Tutti', ...new Set(history.map(e => e.category))];
  catsEl.innerHTML = cats.map(c => {
  const active = c === _testActiveCat;
  const col = _CAT_COLORS[c] || 'var(--muted)';
  return `<button onclick="setTestCat('${escHtml(c)}')" style="padding:4px 10px;border-radius:16px;font-size:11px;font-weight:700;cursor:pointer;
  background:${active ? col : 'var(--s1)'};color:${active ? '#000' : 'var(--muted)'};
  border:1px solid ${active ? col : 'var(--border)'};transition:.15s">${escHtml(c)}</button>`;
  }).join('');

  // Filtra per categoria attiva
  const filtered = Object.entries(byTest).filter(([, v]) =>
  _testActiveCat === 'Tutti' || v.cat === _testActiveCat
  );

  if (filtered.length === 0) {
  listEl.innerHTML = '<div style="color:var(--muted);font-size:12px;padding:8px 0;">Nessun test in questa categoria.</div>';
  return;
  }

  // Raggruppa per categoria per il display
  const byCat = {};
  filtered.forEach(([name, data]) => {
  if (!byCat[data.cat]) byCat[data.cat] = [];
  byCat[data.cat].push([name, data]);
  });

  const fmtVal = (v, unit) => `${unit === 'mm:ss' ? _fmtSec(v) : v}${unit && unit !== 'mm:ss' ? ' ' + unit : ''}`;
  const _fmtSec = s => { const m = Math.floor(s/60); const sec = Math.round(s%60); return `${m}:${sec.toString().padStart(2,'0')}`; };

  listEl.innerHTML = Object.entries(byCat).map(([cat, tests]) => {
  const col = _CAT_COLORS[cat] || 'var(--muted)';
  const rows = tests.map(([name, data]) => {
  const entries = data.entries;
  const last = entries[entries.length - 1];
  const prev = entries.length > 1 ? entries[entries.length - 2] : null;
  const lib = data.lib;

  let deltaHtml = '';
  if (prev) {
  const d = last.value - prev.value;
  const improved = lib ? d < 0 : d > 0;
  const sign = d > 0 ? '+' : '';
  const dCol = improved ? 'var(--teal)' : d === 0 ? 'var(--muted)' : 'var(--coral)';
  deltaHtml = `<span style="font-size:10px;font-weight:700;color:${dCol};">${sign}${d.toFixed(2)}</span>`;
  }

  const prBadge = entries.length > 1 && (() => {
  const best = lib
  ? Math.min(...entries.map(e => e.value))
  : Math.max(...entries.map(e => e.value));
  return last.value === best;
  })()
  ? `<span style="font-size:9px;font-weight:800;color:#f59e0b;margin-left:4px;background:rgba(245,158,11,0.15);padding:1px 5px;border-radius:4px;"> BEST</span>` : '';

  return `<div onclick="showTestChart('${escHtml(name)}', '${escHtml(ath.id)}')"
  style="display:flex;align-items:center;gap:8px;padding:8px 10px;margin-bottom:3px;
  background:var(--s1);border-radius:8px;cursor:pointer;transition:.15s"
  onmouseover="this.style.background='var(--s2)'" onmouseout="this.style.background='var(--s1)'">
  <div style="flex:1;min-width:0;">
  <div style="font-size:12px;font-weight:700;color:var(--text);">${escHtml(name)}${prBadge}</div>
  <div style="font-size:10px;color:var(--muted);">${entries.length} mis. · ultima: ${last.date}</div>
  </div>
  <div style="text-align:right;flex-shrink:0;">
  <div style="font-size:15px;font-weight:800;color:${col};">${fmtVal(last.value, last.unit)}</div>
  <div style="min-height:14px;">${deltaHtml}</div>
  </div>
  </div>`;
  }).join('');

  return `<div style="margin-bottom:10px;">
  <div style="font-size:10px;font-weight:800;color:${col};text-transform:uppercase;letter-spacing:0.5px;
  margin-bottom:5px;padding-left:2px;">${escHtml(cat)}</div>
  ${rows}
  </div>`;
  }).join('');
}

export function setTestCat(cat) {
  _testActiveCat = cat;
  const ath = DB.athletes.find(a => a.id === appState.selAthId);
  renderTestDB(ath);
  closeTestChart();
}

export function showTestChart(testName, athId) {
  const ath = DB.athletes.find(a => a.id === athId);
  if (!ath || !ath.testHistory) return;

  const entries = [...ath.testHistory]
  .filter(e => e.test === testName)
  .sort((a, b) => a.date.localeCompare(b.date));
  if (entries.length < 2) { toast('Servono almeno 2 misurazioni per il grafico'); return; }

  const wrap = document.getElementById('an-test-chart-wrap');
  const title = document.getElementById('an-test-chart-title');
  const canvas= document.getElementById('an-test-chart');
  if (!wrap || !canvas) return;

  if (testChartInstance) { testChartInstance.destroy(); testChartInstance = null; }

  wrap.style.display = 'block';
  title.textContent = testName;

  const col = _CAT_COLORS[entries[0].category] || 'var(--teal)';
  testChartInstance = new window.Chart(canvas, {
  type: 'line',
  data: {
  labels: entries.map(e => e.date.slice(5)),
  datasets: [{
  label: testName,
  data: entries.map(e => e.value),
  borderColor: col,
  backgroundColor: col + '22',
  tension: 0.3,
  pointRadius: 5,
  pointBackgroundColor: col,
  fill: true,
  }]
  },
  options: {
  responsive: true, maintainAspectRatio: false,
  plugins: { legend: { display: false } },
  scales: {
  x: { ticks: { color: '#6B7280', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.04)' } },
  y: { ticks: { color: col, font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.04)' } }
  }
  }
  });
}

export function closeTestChart() {
  const wrap = document.getElementById('an-test-chart-wrap');
  if (wrap) wrap.style.display = 'none';
  if (testChartInstance) { testChartInstance.destroy(); testChartInstance = null; }
}

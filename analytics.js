/* ══════════════════════════════════════════════════════════════
   ELITE SPORTS SCIENCE — analytics.js
   Responsabilità:
     1.  calculateACWR(athId)              — EWMA duale Gym/Campo
     2.  window.renderE1rmChart()                 — Grafico line e1RM per settimana
     3.  window.renderAnalytics()                 — Orchestratore pannello Analytics:
     4.  calculateEfficiencyIndex(athId)   — Tonnellaggio / sRPE per settimana
     5.  calculateProgressionIndex(exName) — % incremento e1RM settimanale
     6.  getRollingHrvTrend(athId, days)   — Media mobile 7 gg HRV
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
     e1rmChartInstance         (let — locale al modulo)
     hrvPerfChart              (let — locale al modulo)

   Dipendenze globali (definite in app.js / auth.js / wellness.js):
     DB, appState.selAthId, athById(), calculateACWR()
   ══════════════════════════════════════════════════════════════ */

import { DB, appState } from './state.js';
import { uid, escHtml, toast, athName, athById } from './utils.js';


// Istanze Chart.js — distrutte e ricreate ad ogni render
let e1rmChartInstance = null;
let hrvPerfChart      = null;


// ─────────────────────────────────────────────────────────────
// 1. calculateACWR(athId)
//    Calcola l'Acute:Chronic Workload Ratio su due binari
//    paralleli e indipendenti tramite EWMA (Exponentially
//    Weighted Moving Average):
//
//      Binario GYM   → tonnellaggio meccanico (kg)
//        αAcute  ≈ 0.33  (~1 settimana di memoria)
//        αChronic ≈ 0.05  (~4 settimane di memoria)
//
//      Binario CAMPO → carico specifico sRPE (UA)
//        stessi coefficienti
//
//    Classificazione del ratio:
//      [0.8 – 1.3] → Ottimale   (verde)
//      (1.3 – 1.5] → Aumentato  (ambra)
//      > 1.5       → DANGER     (rosso)
//      < 0.8 / N/A → muted
//
//    Requisito minimo: 7 sessioni totali.
//    Restituisce: { gym: {value, text, color}, field: {value, text, color} }
// ─────────────────────────────────────────────────────────────
export function calculateACWR(athId) {
    // Copia difensiva — non muta mai l'array globale durante l'iterazione
    const s = [...DB.sessions]
        .filter(x => x.athlete === athId)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Soglia minima per uno storico affidabile
    if (s.length < 7) {
        return {
            gym:   { value: null, text: 'Dati insufficienti', color: 'var(--muted)' },
            field: { value: null, text: 'Dati insufficienti', color: 'var(--muted)' }
        };
    }

    // Coefficienti di decadimento esponenziale
    const alphaAcute   = 0.33; // ~1 settimana
    const alphaChronic = 0.05; // ~4 settimane

    let ewmaAcuteVol   = 0, ewmaChronicVol = 0;
    let ewmaAcuteRpe   = 0, ewmaChronicRpe = 0;
    let hasGym         = false, hasField = false;

    // Iterazione cronologica — i due binari si aggiornano indipendentemente
    s.forEach(session => {
        const isCampo = session.sessionType === 'Campo';

        if (!isCampo) {
            // ── Binario GYM: tonnellaggio meccanico ──────────
            const vol = session.vol || 0;
            if (!hasGym) {
                ewmaAcuteVol = vol; ewmaChronicVol = vol; hasGym = true;
            } else {
                ewmaAcuteVol   = (alphaAcute   * vol) + ((1 - alphaAcute)   * ewmaAcuteVol);
                ewmaChronicVol = (alphaChronic * vol) + ((1 - alphaChronic) * ewmaChronicVol);
            }
        } else {
            // ── Binario CAMPO: carico specifico sRPE ─────────
            const srpe = session.sRPE || 0;
            if (!hasField) {
                ewmaAcuteRpe = srpe; ewmaChronicRpe = srpe; hasField = true;
            } else {
                ewmaAcuteRpe   = (alphaAcute   * srpe) + ((1 - alphaAcute)   * ewmaAcuteRpe);
                ewmaChronicRpe = (alphaChronic * srpe) + ((1 - alphaChronic) * ewmaChronicRpe);
            }
        }
    });

    const ratioVol = (hasGym  && ewmaChronicVol > 0) ? (ewmaAcuteVol / ewmaChronicVol) : 0;
    const ratioRpe = (hasField && ewmaChronicRpe > 0) ? (ewmaAcuteRpe / ewmaChronicRpe) : 0;

    const classify = r => {
        if (r === 0)              return { value: 'N/A',          text: 'Nessun dato', color: 'var(--muted)' };
        if (r >= 0.8 && r <= 1.3) return { value: r.toFixed(2),  text: 'Ottimale',    color: 'var(--teal)'  };
        if (r > 1.3  && r <= 1.5) return { value: r.toFixed(2),  text: 'Aumentato',   color: 'var(--amber)' };
        return                           { value: r.toFixed(2),  text: 'DANGER',      color: 'var(--coral)' };
    };

    return { gym: classify(ratioVol), field: classify(ratioRpe) };
}


// ─────────────────────────────────────────────────────────────
// 2. window.renderE1rmChart(sessionFilter, exerciseFilter)
//    Grafico line — Evoluzione del picco e1RM settimana per
//    settimana, filtrata per sessione e opzionalmente per esercizio.
//    Stato vuoto premium: messaggio inline centrato sul canvas.
//    Gradient fill verde OLED dal 40% all'0% di opacità.
// ─────────────────────────────────────────────────────────────
export function window.renderE1rmChart(sessionFilter, exerciseFilter) {
    const ctxE1rm   = document.getElementById('chart-e1rm');
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
        msg.innerHTML = '<span style="font-size:24px; margin-bottom:8px; display:block;">🎯</span>'
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
    const weeks     = [...new Set(cronoSess.map(s => s.week))].sort((a, b) => a - b);
    const e1rmMappa = {};
    weeks.forEach(w => { e1rmMappa[w] = 0; });
    cronoSess.forEach(s => {
        const val = exerciseFilter
            ? ((s.e1rmPerExercise && s.e1rmPerExercise[exerciseFilter]) || 0)
            : (s.maxE1rm || 0);
        if (s.week && val > e1rmMappa[s.week]) e1rmMappa[s.week] = val;
    });

    const chartLabels     = weeks.map(w => `Settimana ${w}`);
    const chartDataValues = weeks.map(w => e1rmMappa[w] || 0);

    const datasetLabel = exerciseFilter
        ? `${exerciseFilter} — e1RM (kg)`
        : (sessionFilter ? `${sessionFilter} — e1RM Max (kg)` : 'Massimale Stimato (e1RM kg)');

    if (e1rmChartInstance) e1rmChartInstance.destroy();

    const gradient = ctxE1rm.getContext('2d').createLinearGradient(0, 0, 0, 220);
    gradient.addColorStop(0, 'rgba(16, 185, 129, 0.4)');
    gradient.addColorStop(1, 'rgba(16, 185, 129, 0.0)');

    e1rmChartInstance = new Chart(ctxE1rm, {
        type: 'line',
        data: {
            labels: chartLabels,
            datasets: [{
                label:                datasetLabel,
                data:                 chartDataValues,
                borderColor:          '#10B981',
                backgroundColor:      gradient,
                borderWidth:          3,
                pointBackgroundColor: '#10B981',
                pointBorderColor:     '#05070A',
                pointBorderWidth:     2,
                pointRadius:          4,
                pointHoverRadius:     7,
                tension:              0.3,
                fill:                 true
            }]
        },
        options: {
            responsive:          true,
            maintainAspectRatio: false,
            interaction:         { mode: 'index', intersect: false },
            plugins: {
                legend:  { display: false },
                tooltip: {
                    backgroundColor: 'rgba(22, 30, 46, 0.9)',
                    titleFont:       { family: '-apple-system', size: 13, weight: 'bold' },
                    padding:         12,
                    cornerRadius:    8,
                    displayColors:   false
                }
            },
            scales: {
                x: {
                    grid:  { display: false },
                    ticks: { color: '#9CA3AF', font: { family: '-apple-system', size: 11, weight: '600' } }
                },
                y: {
                    grid:  { color: 'rgba(255,255,255,0.04)', drawBorder: false },
                    ticks: { color: '#9CA3AF', font: { family: '-apple-system', size: 11, weight: '600' }, suggestedMin: 40 }
                }
            }
        }
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
//    Orchestratore principale del pannello Analytics.
//    Chiama in sequenza tutti i sotto-motori di calcolo e
//    rendering. Non accetta argomenti: legge appState.selAthId e DB
//    dallo stato globale.
// ─────────────────────────────────────────────────────────────
export function window.renderAnalytics() {
    const ath  = athById(appState.selAthId);
    const sess = DB.sessions.filter(s => s.athlete === appState.selAthId);

    // ── a) Sottotitolo + storico antropometrico ──────────────
    document.getElementById('an-sub').textContent =
        ath ? `${ath.name} · ${sess.length} sessioni` : '';

    const antDiv = document.getElementById('an-antropo-history');
    if (antDiv && ath && ath.anthropoHistory) {
        antDiv.innerHTML = ath.anthropoHistory.map(h =>
            `<div>🗓️ <strong>${h.date}</strong> — `
            + `Peso: <span style="color:var(--teal)">${h.weight} kg</span> | `
            + `BF: <span style="color:var(--purple)">${h.bf}%</span></div>`
        ).join('');
    }

    // ── b) Inietta il wrapper del Radar (DOM dinamico) ───────
    const radarWrapper = document.getElementById('radar-wrapper');
    if (radarWrapper) {
        radarWrapper.innerHTML = `
        <div class="card" id="radar-container"
             style="margin-bottom:12px; margin-top:12px; position:relative;">
          <div class="card-t" style="text-align:center;">
            Profilo Biologico (Stato Attuale vs Picco Storico)
          </div>
          <div id="radar-charts-area" style="display:flex; gap:8px; justify-content:space-around;">
            <div style="flex:1; text-align:center; min-width:0;">
              <div style="font-size:9px; color:var(--teal); font-weight:800;
                          text-transform:uppercase; letter-spacing:1px; margin-bottom:4px;">
                Recupero &amp; SNC
              </div>
              <div style="position:relative; height:200px;">
                <canvas id="chart-radar-recovery"></canvas>
              </div>
            </div>
            <div style="flex:1; text-align:center; min-width:0;">
              <div style="font-size:9px; color:var(--amber); font-weight:800;
                          text-transform:uppercase; letter-spacing:1px; margin-bottom:4px;">
                Performance
              </div>
              <div style="position:relative; height:200px;">
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
        { key: 'vol',    label: 'Volume (t)',         fmt: v => (v / 1000).toFixed(2), color: 'var(--teal)'   },
        { key: 'sRPE',   label: 'Carico Interno (UA)',fmt: v => Math.round(v),         color: 'var(--purple)' },
        { key: 'maxE1rm',label: 'e1RM Max (kg)',      fmt: v => Math.round(v),         color: 'var(--amber)'  }
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
        const cur  = vals[vals.length - 1] || 0;

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
        const maxDom    = lastUniSess.e1rmDom;
        const maxNDom   = lastUniSess.e1rmNDom;
        const diff      = Math.abs(maxDom - maxNDom);
        const maxVal    = Math.max(maxDom, maxNDom) || 1;
        const deficitPerc = ((diff / maxVal) * 100).toFixed(1);

        let alertColor = 'var(--teal)';
        let lsiStatus  = 'Simmetria Ottimale (Deficit < 10%)';
        let lsiBg      = 'rgba(16, 185, 129, 0.1)';

        if (deficitPerc > 15) {
            alertColor = 'var(--coral)';
            lsiStatus  = '⚠️ RED FLAG CLINICA (Deficit > 15%)';
            lsiBg      = 'rgba(239, 68, 68, 0.15)';
        } else if (deficitPerc > 10) {
            alertColor = 'var(--amber)';
            lsiStatus  = '⚡ Asimmetria Lieve (Monitorare)';
            lsiBg      = 'rgba(245, 158, 11, 0.15)';
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
    let acwrHtml  = '';

    if (acwrRes && acwrRes.field.value !== null) {
        acwrHtml = `
        <div class="ins" style="border-color:${acwrRes.field.color}; color:${acwrRes.field.color}">
          <strong>ACWR Campo (sRPE):</strong> ${acwrRes.field.value} — ${acwrRes.field.text}
        </div>
        <div class="ins" style="border-color:${acwrRes.gym.color}; color:${acwrRes.gym.color}">
          <strong>ACWR Gym (Tonnellaggio):</strong> ${acwrRes.gym.value} — ${acwrRes.gym.text}
        </div>`;
    } else {
        acwrHtml = `
        <div class="ins" style="border-color:var(--muted); color:var(--muted)">
          Dati insufficienti per il calcolo ACWR (minimo 7 sessioni).
        </div>`;
    }

    // ── f) INDICI DI FOSTER — Monotonia e Strain ─────────────
    //    Calcolati sull'ultima settimana con almeno 2 sessioni
    //    con sRPE registrato.
    //
    //    Monotonia = μ(carico) / σ(carico)
    //    Strain    = Σ(carichi settimana) × Monotonia
    //
    //    Soglie cliniche:
    //      < 1.5  → Variazione ottimale (DUP efficace)
    //      ≥ 1.5  → Rischio monotonia (scarico necessario)
    //      ≥ 2.0  → ALLERTA monotonia eccessiva
    const lastWeek = weeks.length > 0 ? weeks[weeks.length - 1] : null;
    let fosterHtml = `
    <div style="margin-top:10px; background:var(--s2); border:1px dashed var(--border);
                padding:10px; border-radius:8px; font-size:11px; color:var(--muted); text-align:center;">
      Dati insufficienti per Indici di Foster. Servono almeno 2 sedute nella stessa settimana.
    </div>`;

    if (lastWeek !== null) {
        const lastWeekSess = sess.filter(s => s.week === lastWeek && s.sRPE > 0);

        if (lastWeekSess.length > 1) {
            const loads    = lastWeekSess.map(s => s.sRPE);
            const sumLoad  = loads.reduce((a, b) => a + b, 0);
            const avgLoad  = sumLoad / loads.length;
            const variance = loads.reduce((a, b) => a + Math.pow(b - avgLoad, 2), 0) / loads.length;
            const stdDev   = Math.sqrt(variance);

            // Se la deviazione standard è troppo bassa (<5 UA) il carico è piatto → monotonia alta
            const monotony = stdDev > 5 ? (avgLoad / stdDev) : 3.0;
            const strain   = sumLoad * monotony;

            let mColor  = 'var(--teal)';
            let mStatus = 'Variazione Ottimale (DUP Efficace)';
            let mBg     = 'rgba(16, 185, 129, 0.1)';

            if (monotony >= 2.0) {
                mColor  = 'var(--coral)';
                mStatus = '⚠️ ALLERTA: Monotonia Eccessiva (>2.0)';
                mBg     = 'rgba(239, 68, 68, 0.15)';
            } else if (monotony >= 1.5) {
                mColor  = 'var(--amber)';
                mStatus = '⚡ Rischio Monotonia (Scarico Necessario)';
                mBg     = 'rgba(245, 158, 11, 0.15)';
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
    //    Requisito minimo: 3 sessioni con HRV > 0 e maxE1rm > 0.
    //    Nasconde la card se i dati sono insufficienti.
    const ctxHrv  = document.getElementById('chart-hrv-perf');
    const cardHrv = document.getElementById('card-hrv-perf');

    if (ctxHrv && cardHrv) {
        const validData = sess.filter(s => s.hrv > 0 && s.maxE1rm > 0);

        if (validData.length >= 10) {
            cardHrv.style.display = 'block';

            // Regressione lineare semplice: y = a + b*x
            const n    = validData.length;
            const sumX  = validData.reduce((s, p) => s + p.hrv,          0);
            const sumY  = validData.reduce((s, p) => s + p.maxE1rm,      0);
            const sumXY = validData.reduce((s, p) => s + p.hrv * p.maxE1rm, 0);
            const sumX2 = validData.reduce((s, p) => s + p.hrv * p.hrv,  0);
            const denom = n * sumX2 - sumX * sumX;
            const b     = denom !== 0 ? (n * sumXY - sumX * sumY) / denom : 0;
            const a     = (sumY - b * sumX) / n;

            // r²
            const yMean = sumY / n;
            const ssTot = validData.reduce((s, p) => s + Math.pow(p.maxE1rm - yMean,         2), 0);
            const ssRes = validData.reduce((s, p) => s + Math.pow(p.maxE1rm - (a + b * p.hrv), 2), 0);
            const r2    = ssTot > 0 ? Math.max(0, 1 - ssRes / ssTot) : 0;

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
                            label:           'HRV vs e1RM',
                            data:            scatterData,
                            backgroundColor: 'rgba(16,185,129,0.75)',
                            borderColor:     '#059669',
                            pointRadius:     6,
                            pointHoverRadius:8
                        },
                        {
                            type:        'line',
                            label:       'Trendline',
                            data:        trendData,
                            borderColor: 'rgba(245,158,11,0.85)',
                            borderWidth: 2,
                            borderDash:  [5, 4],
                            pointRadius: 0,
                            fill:        false
                        }
                    ]
                },
                options: {
                    responsive:          true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend:  { display: false },
                        tooltip: {
                            backgroundColor: 'rgba(22,30,46,0.92)',
                            titleFont:       { family: '-apple-system', size: 12 },
                            padding:         10,
                            cornerRadius:    8,
                            filter:          item => item.datasetIndex === 0,
                            callbacks: {
                                footer: () => [`r² = ${r2.toFixed(3)}`]
                            }
                        }
                    },
                    scales: {
                        x: {
                            title: { display: true, text: 'HRV pre-sessione (ms)', color: '#9CA3AF', font: { size: 10 } },
                            grid:  { color: 'rgba(255,255,255,0.05)' },
                            ticks: { color: '#9CA3AF', font: { size: 10 } }
                        },
                        y: {
                            title: { display: true, text: 'Picco e1RM (kg)', color: '#9CA3AF', font: { size: 10 } },
                            grid:  { color: 'rgba(255,255,255,0.05)' },
                            ticks: { color: '#9CA3AF', font: { size: 10 } }
                        }
                    }
                }
            });
        } else {
            cardHrv.style.display = 'none';
        }
    }

    // ── h) RADAR CHART — Profilo Biologico (due istanze) ─────
    //    radarRecovery   → Readiness, HRV, SNC (Tap)
    //    radarPerformance → Forza Max, Cap. Lavoro, LSI
    //
    //    HRV baseline = media mobile degli ultimi 30 giorni via
    //    getRollingHrvTrend (fallback 65 ms se storico assente).
    const ctxRecovery      = document.getElementById('chart-radar-recovery');
    const ctxPerf          = document.getElementById('chart-radar-performance');
    const radarPlaceholder = document.getElementById('radar-placeholder');
    const radarChartsArea  = document.getElementById('radar-charts-area');

    if (ctxRecovery && ctxPerf && radarPlaceholder && radarChartsArea) {
        if (sess.length < 2) {
            radarChartsArea.style.display  = 'none';
            radarPlaceholder.style.display = 'flex';
            radarPlaceholder.innerHTML =
                `📊 <strong style="color:var(--teal)">Raccogliendo dati biomeccanici...</strong><br>`
                + `Il profilo biologico a ragnatela richiede almeno 2 sessioni registrate `
                + `nello storico dell'atleta per tracciare i picchi prestazionali.`;
        } else {
            radarChartsArea.style.display  = 'flex';
            radarPlaceholder.style.display = 'none';

            // HRV baseline dinamica: media ultimi 30 giorni
            const hrvTrend   = getRollingHrvTrend(appState.selAthId, 30);
            const hrvBaseline = hrvTrend.length > 0
                ? parseFloat((hrvTrend.reduce((s, p) => s + p.hrv, 0) / hrvTrend.length).toFixed(1))
                : 65;

            const maxE1rmHistory = Math.max(...sess.map(s => s.maxE1rm), 1);
            const maxVolHistory  = Math.max(...sess.map(s => s.vol),     1);
            const cnsRecord      = ath.cnsRecord || 45;

            const lastSess      = sess[sess.length - 1];
            const currReadiness = DB.wellness.readinessScore || 0;
            const currCNS       = DB.wellness.cnsScore       || cnsRecord;
            const currHRV       = DB.wellness.hrv            || hrvBaseline;

            const scoreForza     = Math.min((lastSess.maxE1rm / maxE1rmHistory) * 100, 100) || 0;
            const scoreLavoro    = Math.min((lastSess.vol      / maxVolHistory)  * 100, 100) || 0;
            const scoreReadiness = currReadiness;
            const scoreCNS       = Math.min((currCNS / cnsRecord)   * 100, 100);
            const scoreHRV       = Math.min((currHRV / hrvBaseline) * 100, 100);

            let scoreSimmetria = 100;
            if (lastUniSess) {
                const maxD    = lastUniSess.e1rmDom;
                const maxND   = lastUniSess.e1rmNDom;
                const diff    = Math.abs(maxD - maxND);
                const maxV    = Math.max(maxD, maxND) || 1;
                scoreSimmetria = Math.max(100 - (diff / maxV) * 100, 0);
            }

            const sharedRadarOpts = {
                responsive:          true,
                maintainAspectRatio: false,
                scales: {
                    r: {
                        angleLines:  { color: 'rgba(255,255,255,0.1)' },
                        grid:        { color: 'rgba(255,255,255,0.1)' },
                        pointLabels: { color: '#9CA3AF', font: { size: 9, family: '-apple-system', weight: '700' } },
                        ticks:       { display: false, min: 0, max: 100 }
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
                        label:                'Recupero',
                        data:                 [scoreReadiness, scoreHRV, scoreCNS],
                        backgroundColor:      'rgba(16, 185, 129, 0.2)',
                        borderColor:          '#10B981',
                        pointBackgroundColor: '#10B981',
                        pointBorderColor:     '#fff',
                        borderWidth:          2
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
                        label:                'Performance',
                        data:                 [scoreForza, scoreLavoro, scoreSimmetria],
                        backgroundColor:      'rgba(245, 158, 11, 0.2)',
                        borderColor:          '#F59E0B',
                        pointBackgroundColor: '#F59E0B',
                        pointBorderColor:     '#fff',
                        borderWidth:          2
                    }]
                },
                options: sharedRadarOpts
            });
        }
    }

    // ── j) PEAKING / TAPERING — Grafico a doppia scala ───────
    //    Line (forza e1RM) + Bar (volume kg) per settimana.
    //    Badge rilevamento automatico del trend:
    //      Vol↓ + Int↑ → Peaking Ottimale
    //      Vol↑        → Fase Accumulo
    //      Altro       → Transizione / Mantenimento
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

    const ctxPeaking        = document.getElementById('chart-peaking');
    const peakingPlaceholder = document.getElementById('peaking-placeholder');

    if (ctxPeaking && peakingPlaceholder) {
        // Usa validWeeks: settimane con ≥ 2 sessioni evitano crolli falsi nel volume
        const peakWeeks = validWeeks;

        if (peakWeeks.length < 2) {
            ctxPeaking.style.display        = 'none';
            peakingPlaceholder.style.display = 'flex';
            peakingPlaceholder.innerHTML     =
                `📈 <strong style="color:var(--blue)">Analisi Peaking in corso...</strong><br>`
                + `Servono almeno 2 settimane con ≥ 2 sessioni ciascuna per confrontare Volume e Intensità.`;
            document.getElementById('peaking-badge').style.display = 'none';
        } else {
            ctxPeaking.style.display        = 'block';
            peakingPlaceholder.style.display = 'none';

            // Aggregazione: volume normalizzato per sessione + picco e1RM
            const weeklyVolNorm = []; // kg / sessione
            const weeklyInt     = []; // e1RM max
            peakWeeks.forEach(w => {
                const wSess   = sess.filter(s => s.week === w);
                const sumVol  = wSess.reduce((a, b) => a + (b.vol || 0), 0);
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
                    badge.textContent           = '✅ Peaking Ottimale';
                    badge.style.backgroundColor = 'rgba(16, 185, 129, 0.2)';
                    badge.style.color           = 'var(--teal)';
                } else if (lastVol > prevVol) {
                    badge.textContent           = '🧱 Fase Accumulo';
                    badge.style.backgroundColor = 'rgba(59, 130, 246, 0.2)';
                    badge.style.color           = 'var(--blue)';
                } else {
                    badge.textContent           = '⚡ Transizione / Mantenimento';
                    badge.style.backgroundColor = 'rgba(245, 158, 11, 0.2)';
                    badge.style.color           = 'var(--amber)';
                }
            }

            if (window.peakingChartInstance) window.peakingChartInstance.destroy();
            window.peakingChartInstance = new Chart(ctxPeaking, {
                type: 'line',
                data: {
                    labels:   peakWeeks.map(w => `W${w}`),
                    datasets: [
                        {
                            type:            'line',
                            label:           'e1RM (kg)',
                            data:            weeklyInt,
                            borderColor:     '#F59E0B',
                            backgroundColor: 'rgba(245,158,11,0.08)',
                            borderWidth:     3,
                            pointRadius:     4,
                            pointBackgroundColor: '#F59E0B',
                            yAxisID:         'y-int',
                            tension:         0.3,
                            fill:            false
                        },
                        {
                            type:            'bar',
                            label:           'Vol. norm. (kg/sess.)',
                            data:            weeklyVolNorm,
                            backgroundColor: 'rgba(59, 130, 246, 0.3)',
                            borderColor:     'rgba(59, 130, 246, 0.8)',
                            borderWidth:     1,
                            borderRadius:    4,
                            yAxisID:         'y-vol'
                        }
                    ]
                },
                options: {
                    responsive:          true,
                    maintainAspectRatio: false,
                    interaction:         { mode: 'index', intersect: false },
                    plugins: {
                        legend: {
                            display:  true,
                            position: 'bottom',
                            labels:   { color: '#9CA3AF', font: { size: 9 }, boxWidth: 12 }
                        },
                        tooltip: {
                            backgroundColor: 'rgba(22, 30, 46, 0.95)',
                            titleFont:       { family: '-apple-system', size: 12, weight: 'bold' },
                            bodyFont:        { family: '-apple-system', size: 11, weight: '500' },
                            padding:         10,
                            cornerRadius:    8
                        }
                    },
                    scales: {
                        x: {
                            grid:  { display: false },
                            ticks: { color: '#9CA3AF', font: { size: 10, weight: '600' } }
                        },
                        'y-vol': {
                            type:        'linear',
                            display:     true,
                            position:    'left',
                            beginAtZero: true,
                            grid:        { color: 'rgba(255,255,255,0.04)' },
                            ticks:       { color: '#6B7280', font: { size: 9 } },
                            title: {
                                display: true,
                                text:    'Vol. norm. (kg/sess.)',
                                color:   'rgba(59,130,246,0.7)',
                                font:    { size: 9 }
                            }
                        },
                        'y-int': {
                            type:        'linear',
                            display:     true,
                            position:    'right',
                            suggestedMin: 20,
                            grid:        { drawOnChartArea: false },
                            ticks:       { color: '#6B7280', font: { size: 9 } },
                            title: {
                                display: true,
                                text:    'e1RM (kg)',
                                color:   'rgba(245,158,11,0.7)',
                                font:    { size: 9 }
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

                const labels      = hrvTrendData.map(p => p.date.slice(5)); // MM-DD
                const dailyVals   = hrvTrendData.map(p => p.hrv);
                const rolling7d   = hrvTrendData.map(p => p.rolling7d);     // null nei primi 6 pt

                window.hrvTrendChartInstance = new Chart(ctxHrvTrend, {
                    type: 'line',
                    data: {
                        labels,
                        datasets: [
                            {
                                label:           'HRV giornaliera (ms)',
                                data:            dailyVals,
                                borderColor:     '#10B981',
                                backgroundColor: 'rgba(16,185,129,0.06)',
                                borderWidth:     1.5,
                                pointRadius:     3,
                                pointBackgroundColor: '#10B981',
                                tension:         0.3,
                                fill:            true
                            },
                            {
                                label:       'Media mobile 7gg (ms)',
                                data:        rolling7d,
                                borderColor: '#A78BFA',
                                borderWidth: 3,
                                borderDash:  [6, 3],
                                pointRadius: 0,
                                tension:     0.4,
                                fill:        false,
                                spanGaps:    false
                            }
                        ]
                    },
                    options: {
                        responsive:          true,
                        maintainAspectRatio: false,
                        interaction:         { mode: 'index', intersect: false },
                        plugins: {
                            legend: {
                                display:  true,
                                position: 'bottom',
                                labels:   { color: '#9CA3AF', font: { size: 9 }, boxWidth: 12 }
                            },
                            tooltip: {
                                backgroundColor: 'rgba(22,30,46,0.92)',
                                titleFont:       { family: '-apple-system', size: 12 },
                                padding:         10,
                                cornerRadius:    8,
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
                                grid:  { display: false },
                                ticks: { color: '#9CA3AF', font: { size: 9 }, maxTicksLimit: 12 }
                            },
                            y: {
                                grid:  { color: 'rgba(255,255,255,0.04)' },
                                ticks: { color: '#9CA3AF', font: { size: 9 } },
                                title: {
                                    display: true,
                                    text:    'HRV (ms)',
                                    color:   '#9CA3AF',
                                    font:    { size: 9 }
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
//    Rapporto settimanale tonnellaggio Gym / sRPE medio.
//    Indice di efficienza meccanica: se a parità di tonnellaggio
//    lo sRPE cresce, l'indice scende → fatica cumulativa crescente.
//
//    Logica:
//      tonnellaggio = somma vol sessioni non-Campo (s.vol, kg)
//      sRPEAvg      = media di tutte le sessioni con sRPE > 0
//      efficiencyIndex = tonnellaggio / sRPEAvg
//
//    Restituisce: array ordinato per settimana di oggetti
//      { week, tonnellaggio, sRPEAvg, efficiencyIndex }
//    Le settimane prive di entrambi i segnali sono escluse.
// ─────────────────────────────────────────────────────────────
export function calculateEfficiencyIndex(athId) {
    const sess  = DB.sessions.filter(s => s.athlete === athId);
    const weeks = [...new Set(sess.map(s => s.week))].sort((a, b) => a - b);

    const result = [];
    weeks.forEach(w => {
        const wSess        = sess.filter(s => s.week === w);
        const gymSess      = wSess.filter(s => s.sessionType !== 'Campo' && s.vol > 0);
        const tonnellaggio = gymSess.reduce((sum, s) => sum + s.vol, 0);

        const srpeSess     = wSess.filter(s => s.sRPE > 0);
        const sRPEAvg      = srpeSess.length
            ? srpeSess.reduce((sum, s) => sum + s.sRPE, 0) / srpeSess.length
            : 0;

        if (sRPEAvg > 0 && tonnellaggio > 0) {
            result.push({
                week:            w,
                tonnellaggio,
                sRPEAvg:         parseFloat(sRPEAvg.toFixed(1)),
                efficiencyIndex: parseFloat((tonnellaggio / sRPEAvg).toFixed(2))
            });
        }
    });

    return result;
}


// ─────────────────────────────────────────────────────────────
// 5. calculateProgressionIndex(exName, weeks = 4)
//    Analizza la serie storica dell'e1RM stimato per l'esercizio
//    `exName` (source: session.e1rmPerExercise) e restituisce
//    la % di incremento medio settimanale nelle ultime `weeks`
//    settimane con dato disponibile.
//
//    Restituisce:
//      weeklyData    → [{ week, e1rm }] — tutta la storia
//      avgWeeklyGain → % incremento medio per settimana (può essere <0)
//      totalGain     → % incremento totale nel periodo considerato
// ─────────────────────────────────────────────────────────────
export function calculateProgressionIndex(exName, weeks = 4) {
    const sess = DB.sessions.filter(
        s => s.athlete === appState.selAthId &&
             s.e1rmPerExercise &&
             (s.e1rmPerExercise[exName] || 0) > 0
    );

    if (sess.length === 0) return { weeklyData: [], avgWeeklyGain: 0, totalGain: 0 };

    // Picco e1RM per settimana, in ordine cronologico
    const allWeeks   = [...new Set(sess.map(s => s.week))].sort((a, b) => a - b);
    const weeklyData = allWeeks.map(w => {
        const wSess = sess.filter(s => s.week === w);
        const e1rm  = Math.max(...wSess.map(s => s.e1rmPerExercise[exName]));
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

    const first     = recentWeeks[0].e1rm;
    const last      = recentWeeks[recentWeeks.length - 1].e1rm;
    const totalGain = first > 0
        ? parseFloat(((last - first) / first * 100).toFixed(2))
        : 0;

    return { weeklyData, avgWeeklyGain, totalGain };
}


// ─────────────────────────────────────────────────────────────
// 6. getRollingHrvTrend(athId, days = 30)
//    Media mobile a 7 giorni della HRV giornaliera estratta da
//    DB.sessions (campo s.hrv — registrato nel Wellness Check-in
//    pre-sessione). Più sessioni nello stesso giorno → media.
//
//    La media mobile è trailing (finestra sugli ultimi 7 punti
//    disponibili), quindi i primi 6 punti della serie hanno
//    rolling7d = null.
//
//    Restituisce: array ordinato per data di oggetti
//      { date: 'YYYY-MM-DD', hrv: number, rolling7d: number|null }
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
        const avg7   = slice7.reduce((sum, p) => sum + p.hrv, 0) / 7;
        return { ...point, rolling7d: parseFloat(avg7.toFixed(1)) };
    });
}

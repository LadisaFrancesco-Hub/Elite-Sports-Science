/* ══════════════════════════════════════════════════════════════
   ELITE SPORTS SCIENCE — badges.js
   Sistema achievement/badge per atleti.
   Storage: localStorage  key = 'badges_<athId>'  → { [badgeId]: isoDate }
   ══════════════════════════════════════════════════════════════ */

import { DB } from './state.js';
import { toast } from './utils.js';

// ─────────────────────────────────────────────────────────────
// DEFINIZIONI BADGE
// ─────────────────────────────────────────────────────────────
export const BADGE_DEFS = [
    // Sessioni
    { id: 'first_session',  name: 'Prima Missione',     icon: '🎯', desc: 'Prima sessione completata',           rarity: 'common',    check: s => s.length >= 1    },
    { id: 'sessions_5',     name: 'In Movimento',       icon: '🌟', desc: '5 sessioni completate',               rarity: 'common',    check: s => s.length >= 5    },
    { id: 'sessions_10',    name: 'Consistente',        icon: '🔟', desc: '10 sessioni completate',              rarity: 'common',    check: s => s.length >= 10   },
    { id: 'sessions_30',    name: 'Veterano',           icon: '🏅', desc: '30 sessioni completate',              rarity: 'rare',      check: s => s.length >= 30   },
    { id: 'sessions_50',    name: 'Atleta Serio',       icon: '💎', desc: '50 sessioni completate',              rarity: 'rare',      check: s => s.length >= 50   },
    { id: 'sessions_100',   name: 'Centenario',         icon: '💯', desc: '100 sessioni completate',             rarity: 'epic',      check: s => s.length >= 100  },

    // Streak
    { id: 'streak_7',       name: 'Fuoco Acceso',       icon: '🔥', desc: '7 giorni di fila senza saltare',      rarity: 'common',    check: (s,a) => _streak(s) >= 7  },
    { id: 'streak_21',      name: 'Abitudine Forgiata', icon: '⚡', desc: '21 giorni consecutivi',               rarity: 'rare',      check: (s,a) => _streak(s) >= 21 },
    { id: 'streak_30',      name: 'Inarrestabile',      icon: '🌊', desc: '30 giorni consecutivi',               rarity: 'epic',      check: (s,a) => _streak(s) >= 30 },

    // PR / Forza
    { id: 'first_pr',       name: 'Primo Record',       icon: '🏆', desc: 'Primo PR personale stabilito',        rarity: 'common',    check: s => s.some(x => (x.maxE1rm||0) > 0)   },
    { id: 'e1rm_100kg',     name: 'Club dei 100',       icon: '💪', desc: 'e1RM ≥100 kg in qualsiasi esercizio', rarity: 'rare',      check: s => s.some(x => (x.maxE1rm||0) >= 100) },
    { id: 'e1rm_150kg',     name: 'Mostro di Ferro',    icon: '🦾', desc: 'e1RM ≥150 kg',                        rarity: 'epic',      check: s => s.some(x => (x.maxE1rm||0) >= 150) },

    // Volume
    { id: 'volume_5t',      name: 'Tiro Pesante',       icon: '🏗️', desc: '5 tonnellate in un mese',            rarity: 'common',    check: s => _maxMonthVol(s) >= 5000   },
    { id: 'volume_10t',     name: 'Macchina da Guerra', icon: '⚙️', desc: '10 tonnellate in un mese',           rarity: 'rare',      check: s => _maxMonthVol(s) >= 10000  },
    { id: 'volume_20t',     name: 'Titanio',            icon: '🔩', desc: '20 tonnellate in un mese',            rarity: 'epic',      check: s => _maxMonthVol(s) >= 20000  },

    // Compliance
    { id: 'compliance_90',  name: 'Perfettista',        icon: '✅', desc: 'Compliance ≥90% in un mese',          rarity: 'rare',      check: (s,a) => _compliance(s,a) >= 90 },

    // Wellness
    { id: 'wellness_7',     name: 'Mindful Athlete',    icon: '🧘', desc: '7 check-in wellness di fila',         rarity: 'common',    check: (s,a) => _wellnessStreak(a) >= 7  },
];

// v4: rarità come intensità dello stesso accento (niente blu/viola fuori palette)
const RARITY_COLOR = {
    common:  { bg: 'rgba(255,255,255,.04)',        border: 'rgba(255,255,255,.14)',        text: 'var(--text2)'     },
    rare:    { bg: 'oklch(0.76 0.16 52 / .08)',    border: 'oklch(0.76 0.16 52 / .35)',    text: 'var(--accent)'    },
    epic:    { bg: 'oklch(0.76 0.16 52 / .18)',    border: 'oklch(0.83 0.14 62 / .75)',    text: 'var(--accent-hi)' },
};


// ─────────────────────────────────────────────────────────────
// HELPERS INTERNI
// ─────────────────────────────────────────────────────────────
function _streak(sessions) {
    if (!sessions.length) return 0;
    const sorted = [...sessions].sort((a,b) => b.date.localeCompare(a.date));
    let streak = 1, prev = new Date(sorted[0].date);
    for (let i = 1; i < sorted.length; i++) {
        const cur  = new Date(sorted[i].date);
        const diff = Math.round((prev - cur) / 86400000);
        if (diff <= 2) { streak++; prev = cur; } else break;
    }
    return streak;
}

function _maxMonthVol(sessions) {
    const byMonth = {};
    sessions.forEach(s => {
        const mk = s.date.slice(0, 7);
        byMonth[mk] = (byMonth[mk] || 0) + (s.vol || 0);
    });
    return Object.values(byMonth).reduce((max, v) => Math.max(max, v), 0);
}

function _compliance(sessions, ath) {
    const freq = ath?.freq ?? 4;
    if (!freq) return 0;
    const now = new Date();
    const thisMo = now.toISOString().slice(0, 7);
    const prevMo = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 7);
    const check = (key) => {
        const n = sessions.filter(s => s.date.startsWith(key)).length;
        return Math.round(n / (freq * 4) * 100);
    };
    return Math.max(check(thisMo), check(prevMo));
}

function _wellnessStreak(ath) {
    const data = DB.wellnessByAthlete?.[ath?.id];
    if (!data?.history) return 0;
    const sorted = [...data.history].sort((a,b) => b.date.localeCompare(a.date));
    let streak = 1, prev = new Date(sorted[0]?.date || new Date());
    for (let i = 1; i < sorted.length; i++) {
        const cur  = new Date(sorted[i].date);
        const diff = Math.round((prev - cur) / 86400000);
        if (diff <= 1) { streak++; prev = cur; } else break;
    }
    return streak;
}


// ─────────────────────────────────────────────────────────────
// loadBadges — legge i badge dall'archiviazione locale
// ─────────────────────────────────────────────────────────────
export function loadBadges(athId) {
    try { return JSON.parse(localStorage.getItem(`badges_${athId}`) || '{}'); }
    catch (_) { return {}; }
}

function _saveBadges(athId, earned) {
    localStorage.setItem(`badges_${athId}`, JSON.stringify(earned));
}


// ─────────────────────────────────────────────────────────────
// checkAndAwardBadges — chiama dopo ogni salvataggio sessione
// Ritorna array di nuovi badge appena sbloccati
// ─────────────────────────────────────────────────────────────
export function checkAndAwardBadges(athId) {
    const sessions = DB.sessions.filter(s => s.athlete === athId);
    const ath      = DB.athletes.find(a => a.id === athId);
    const earned   = loadBadges(athId);
    const newlyEarned = [];

    for (const def of BADGE_DEFS) {
        if (earned[def.id]) continue;
        try {
            if (def.check(sessions, ath)) {
                earned[def.id] = new Date().toISOString().slice(0, 10);
                newlyEarned.push(def);
            }
        } catch (_) {}
    }

    if (newlyEarned.length) {
        _saveBadges(athId, earned);
        newlyEarned.forEach(def => {
            setTimeout(() => {
                toast(`${def.icon} Nuovo badge: "${def.name}" — ${def.desc}`);
            }, 800);
        });
    }

    return newlyEarned;
}


// ─────────────────────────────────────────────────────────────
// badgeStripHtml — striscia compatta per la home atleta.
// Mostra count trofei + streak + ultimo badge sbloccato, cliccabile
// verso il tab Progressi (bacheca completa). Restituisce una stringa HTML
// da embeddare nel template di renderAthHome.
// ─────────────────────────────────────────────────────────────
export function badgeStripHtml(athId, streak = 0) {
    const earned = loadBadges(athId);
    const earnedIds = Object.keys(earned);
    const total = BADGE_DEFS.length;

    // ultimo badge sbloccato (data ISO YYYY-MM-DD → confronto lessicografico)
    let latest = null, latestDate = '';
    for (const id of earnedIds) {
        if (earned[id] > latestDate) {
            const def = BADGE_DEFS.find(d => d.id === id);
            if (def) { latest = def; latestDate = earned[id]; }
        }
    }

    const sub = latest
        ? `Ultimo: ${latest.icon} ${latest.name}`
        : 'Completa una sessione per sbloccare il primo';
    const streakTxt = streak >= 2 ? ` · 🔥 ${streak} di fila` : '';

    const pct = total ? Math.round(earnedIds.length / total * 100) : 0;
    return `
    <div onclick="go('ath-progressi')" class="ax-card ax-trophy">
        <span class="ax-trophy-ic">🏆</span>
        <div style="flex:1;min-width:0">
            <div style="font-size:13.5px;font-weight:700;color:var(--text)"><span style="font-family:var(--fmono)">${earnedIds.length}/${total}</span> trofei${streakTxt}</div>
            <div style="font-size:11.5px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${sub}</div>
            <div class="ax-progress"><i style="width:${Math.max(pct, 2)}%"></i></div>
        </div>
        <span style="color:var(--dim);font-size:14px;flex-shrink:0">›</span>
    </div>`;
}


// ─────────────────────────────────────────────────────────────
// renderBadgesSection — inserisce la trophy shelf nell'elemento dato
// ─────────────────────────────────────────────────────────────
export function renderBadgesSection(containerId, athId) {
    const el = document.getElementById(containerId);
    if (!el) return;

    const sessions = DB.sessions.filter(s => s.athlete === athId);
    const ath      = DB.athletes.find(a => a.id === athId);
    const earned   = loadBadges(athId);

    const badgeHTML = BADGE_DEFS.map(def => {
        const isEarned = !!earned[def.id];
        const col      = RARITY_COLOR[def.rarity];
        const dateStr  = earned[def.id] ? `<div style="font-size:9px;color:var(--muted);margin-top:2px">${earned[def.id]}</div>` : '';
        return `
        <div title="${def.desc}" class="ax-badge${isEarned ? '' : ' is-locked'}"
             style="${isEarned ? `border:1px solid ${col.border};background:${col.bg};` : ''}">
            <div style="font-size:24px;line-height:1.2">${def.icon}</div>
            <div style="font-size:9px;font-weight:700;color:${isEarned ? col.text : 'var(--muted)'};margin-top:4px;line-height:1.3">${def.name}</div>
            ${dateStr}
        </div>`;
    }).join('');

    const earnedCount = Object.keys(earned).length;
    el.innerHTML = `
    <div class="card">
        <div class="card-t" style="display:flex;justify-content:space-between;align-items:center"><span>Trofei</span><span style="color:var(--accent);letter-spacing:.04em">${earnedCount}/${BADGE_DEFS.length}</span></div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(72px,1fr));gap:8px;justify-items:center">
            ${badgeHTML}
        </div>
    </div>`;
}

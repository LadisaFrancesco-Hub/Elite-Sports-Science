/* ══════════════════════════════════════════════════════════════
   ELITE SPORTS SCIENCE — billing.js
   Gestione piani, limiti atleti, upgrade modal, Stripe Checkout
   ══════════════════════════════════════════════════════════════ */

import { appState } from './state.js';
import { toast, openMo, closeMo } from './utils.js';

// ─────────────────────────────────────────────────────────────
// CONFIGURAZIONE PIANI
// ─────────────────────────────────────────────────────────────
export const PLANS = {
    free: { label: 'Free',  athleteLimit: 3,        priceMonthly: 0,  priceYearly: 0    },
    pro:  { label: 'Pro',   athleteLimit: Infinity,  priceMonthly: 29, priceYearly: 249  },
    team: { label: 'Team',  athleteLimit: Infinity,  priceMonthly: 69, priceYearly: null }
};

// Stripe Price IDs — sostituire dopo creazione prodotti su Stripe Dashboard
export const STRIPE_PRICES = {
    pro_monthly:  'price_XXXXXXXXXXXXXXXXXXXXX',
    pro_yearly:   'price_XXXXXXXXXXXXXXXXXXXXX',
    team_monthly: 'price_XXXXXXXXXXXXXXXXXXXXX'
};


// ─────────────────────────────────────────────────────────────
// loadCoachPlan — chiamato subito dopo login coach
// Crea il record coaches se non esiste (ensure_coach_profile RPC)
// ─────────────────────────────────────────────────────────────
export async function loadCoachPlan(userEmail) {
    if (!window.mySupabase) {
        _setDefaultPlan();
        return;
    }
    try {
        const { data, error } = await window.mySupabase.rpc('ensure_coach_profile', {
            p_email: userEmail
        });
        if (error || !data?.length) {
            console.warn('[Billing] ensure_coach_profile error:', error);
            _setDefaultPlan();
            return;
        }
        const row = data[0];
        appState.coachPlan         = row.plan            ?? 'free';
        appState.coachAthleteLimit = row.athlete_limit   ?? 3;
        appState.coachSubStatus    = row.subscription_status ?? 'inactive';
        appState.coachPeriodEnd    = row.current_period_ends_at ?? null;
        console.log(`[Billing] Piano: ${appState.coachPlan} · limite: ${appState.coachAthleteLimit} atleti`);
    } catch (e) {
        console.warn('[Billing] Errore caricamento piano:', e);
        _setDefaultPlan();
    }
    updatePlanBadge();
}

function _setDefaultPlan() {
    appState.coachPlan         = 'free';
    appState.coachAthleteLimit = 3;
    appState.coachSubStatus    = 'inactive';
    appState.coachPeriodEnd    = null;
    updatePlanBadge();
}


// ─────────────────────────────────────────────────────────────
// canAddAthlete — true se l'atleta può essere aggiunto
// ─────────────────────────────────────────────────────────────
export function canAddAthlete(currentCount) {
    const limit = appState.coachAthleteLimit ?? 3;
    return currentCount < limit;
}


// ─────────────────────────────────────────────────────────────
// showUpgradeModal — apre il modal di upgrade
// ─────────────────────────────────────────────────────────────
export function showUpgradeModal(reason = 'limit') {
    const mo = document.getElementById('mo-upgrade');
    if (!mo) { _buildUpgradeModal(); }

    const reasonEl = document.getElementById('upgrade-reason');
    if (reasonEl) {
        if (reason === 'limit') {
            reasonEl.innerHTML = `Hai raggiunto il limite di <strong>3 atleti</strong> del piano Free. Passa a Pro per gestirne quanti vuoi.`;
        } else {
            reasonEl.innerHTML = `Questa funzione richiede il piano Pro o Team.`;
        }
    }
    openMo('mo-upgrade');
}


// ─────────────────────────────────────────────────────────────
// redirectToCheckout — avvia Stripe Checkout
// ─────────────────────────────────────────────────────────────
export async function redirectToCheckout(priceId) {
    if (!window.mySupabase) { toast('❌ Connessione non disponibile'); return; }
    const btn = document.getElementById('upgrade-checkout-btn');
    if (btn) { btn.textContent = '⏳ Apertura pagamento...'; btn.disabled = true; }

    try {
        const { data, error } = await window.mySupabase.functions.invoke('create-checkout-session', {
            body: { price_id: priceId, success_url: window.location.origin + '/?upgraded=1', cancel_url: window.location.href }
        });
        if (error || !data?.url) {
            toast('❌ Errore: ' + (error?.message || 'URL Stripe non ricevuto'));
            if (btn) { btn.textContent = 'Vai a Pro →'; btn.disabled = false; }
            return;
        }
        window.location.href = data.url;
    } catch (e) {
        toast('❌ ' + e.message);
        if (btn) { btn.textContent = 'Vai a Pro →'; btn.disabled = false; }
    }
}


// ─────────────────────────────────────────────────────────────
// getPlanBadgeHTML — badge HTML per sidebar/dashboard
// ─────────────────────────────────────────────────────────────
export function getPlanBadgeHTML() {
    const plan  = appState.coachPlan ?? 'free';
    const label = PLANS[plan]?.label ?? 'Free';
    const color = plan === 'free' ? 'var(--muted)' : plan === 'pro' ? 'var(--teal)' : '#8b5cf6';
    const bg    = plan === 'free' ? 'rgba(160,168,180,.12)' : plan === 'pro' ? 'var(--teal-d)' : 'rgba(139,92,246,.15)';
    return `<span style="display:inline-block;font-size:9px;font-weight:700;padding:2px 7px;border-radius:10px;background:${bg};color:${color};letter-spacing:.08em;text-transform:uppercase;">${label}</span>`;
}


// ─────────────────────────────────────────────────────────────
// checkUpgradeSuccess — gestisce redirect ?upgraded=1 da Stripe
// ─────────────────────────────────────────────────────────────
export function checkUpgradeSuccess() {
    const params = new URLSearchParams(window.location.search);
    if (params.get('upgraded') === '1') {
        toast('🎉 Upgrade completato! Benvenuto in Pro.');
        window.history.replaceState({}, '', window.location.pathname);
    }
}


// ─────────────────────────────────────────────────────────────
// _buildUpgradeModal — crea il modal di upgrade se non esiste
// ─────────────────────────────────────────────────────────────
function _buildUpgradeModal() {
    const mo = document.createElement('div');
    mo.className = 'mo';
    mo.id = 'mo-upgrade';
    mo.innerHTML = `
      <div class="mo-box" style="max-width:420px;">
        <div class="mo-hdr">
          <span class="mo-title">⬆️ Sblocca Piano Pro</span>
          <button class="mo-x" onclick="closeMo('mo-upgrade')">✕</button>
        </div>
        <p id="upgrade-reason" style="font-size:13px;color:var(--muted);margin:0 0 20px;line-height:1.5;"></p>

        <!-- Card Pro -->
        <div style="border:1px solid var(--teal);border-radius:12px;padding:18px;margin-bottom:12px;background:var(--teal-d);">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
            <span style="font-weight:800;font-size:15px;color:var(--teal);">Pro</span>
            <span style="font-size:13px;font-weight:700;color:var(--text);">€29<span style="font-size:10px;color:var(--muted)">/mese</span></span>
          </div>
          <ul style="list-style:none;padding:0;margin:0 0 14px;font-size:12px;color:var(--text);line-height:1.8;">
            <li>✅ Atleti illimitati</li>
            <li>✅ Export PDF report mensile</li>
            <li>✅ Video exercise library</li>
            <li>✅ Nutrition tracking</li>
            <li>✅ Badge & achievement system</li>
            <li>✅ Supporto prioritario</li>
          </ul>
          <div style="display:flex;gap:8px;">
            <button id="upgrade-checkout-btn" class="btn btn-p" style="flex:1;font-size:13px;" onclick="window._billingCheckout('pro_monthly')">Mensile €29/mese →</button>
            <button class="btn btn-g" style="flex:1;font-size:13px;" onclick="window._billingCheckout('pro_yearly')">Annuale €249/anno →</button>
          </div>
        </div>

        <!-- Card Team -->
        <div style="border:1px solid rgba(139,92,246,.35);border-radius:12px;padding:18px;background:rgba(139,92,246,.06);">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
            <span style="font-weight:800;font-size:15px;color:#8b5cf6;">Team</span>
            <span style="font-size:13px;font-weight:700;color:var(--text);">€69<span style="font-size:10px;color:var(--muted)">/mese</span></span>
          </div>
          <ul style="list-style:none;padding:0;margin:0 0 14px;font-size:12px;color:var(--text);line-height:1.8;">
            <li>✅ Tutto il piano Pro</li>
            <li>✅ Fino a 3 coach nel team</li>
            <li>✅ White-label (nome + logo custom)</li>
            <li>✅ Dashboard multi-coach</li>
          </ul>
          <button class="btn btn-g" style="width:100%;font-size:13px;border-color:rgba(139,92,246,.4);color:#8b5cf6;" onclick="window._billingCheckout('team_monthly')">Team €69/mese →</button>
        </div>

        <p style="font-size:10px;color:var(--muted);text-align:center;margin-top:14px;">
          Pagamento sicuro via Stripe · Cancella in qualsiasi momento
        </p>
      </div>`;
    document.body.appendChild(mo);
}

// ─────────────────────────────────────────────────────────────
// updatePlanBadge — aggiorna il badge nella sidebar
// ─────────────────────────────────────────────────────────────
export function updatePlanBadge() {
    const plan  = appState.coachPlan ?? 'free';
    const label = PLANS[plan]?.label ?? 'Free';
    const color = plan === 'free' ? 'var(--muted)' : plan === 'pro' ? 'var(--teal)' : '#8b5cf6';
    const bg    = plan === 'free' ? 'rgba(160,168,180,.12)' : plan === 'pro' ? 'var(--teal-d)' : 'rgba(139,92,246,.15)';

    const badgeEl = document.getElementById('plan-badge-label');
    const subEl   = document.getElementById('plan-badge-sub');
    if (badgeEl) {
        badgeEl.textContent = label;
        badgeEl.style.color      = color;
        badgeEl.style.background = bg;
    }
    if (subEl) {
        subEl.style.display = plan === 'free' ? 'block' : 'none';
    }

    // Mostra nav Team solo per piano Team
    const navTeam = document.getElementById('nav-team-group');
    if (navTeam) navTeam.style.display = plan === 'team' ? '' : 'none';
}

// Espone la funzione di checkout a onclick inline nel modal
window._billingCheckout  = (priceKey) => redirectToCheckout(STRIPE_PRICES[priceKey]);
window._showUpgradeModal = () => showUpgradeModal();

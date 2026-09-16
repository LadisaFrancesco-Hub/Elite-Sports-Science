/* ══════════════════════════════════════════════════════════════
  ELITE SPORTS SCIENCE — team.js
  Multi-coach: gestione team, inviti assistenti, ruoli.
  Piano Team richiesto.
  ══════════════════════════════════════════════════════════════ */

import { appState } from './state.js';
import { toast, escHtml } from './utils.js';

// ─────────────────────────────────────────────────────────────
// renderTeamPanel — pannello gestione team nella dashboard coach
// ─────────────────────────────────────────────────────────────
export async function renderTeamPanel(containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;

  if (appState.coachPlan !== 'team') {
  el.innerHTML = `
  <div class="card" style="border:1px solid var(--border);text-align:center;padding:24px">
  <div style="font-size:32px;margin-bottom:12px"></div>
  <div style="font-size:15px;font-weight:800;color:var(--text);margin-bottom:8px">Multi-Coach Team</div>
  <div style="font-size:12px;color:var(--muted);margin-bottom:16px;line-height:1.6">
  Invita coach assistenti nel tuo team. Condividete gli atleti e la dashboard.<br>Disponibile nel piano Team.
  </div>
  <button onclick="window._showUpgradeModal && window._showUpgradeModal()" class="btn btn-g" style="color:#a78bfa;border-color:rgba(139,92,246,.3)">
  Passa al piano Team
  </button>
  </div>`;
  return;
  }

  el.innerHTML = `<div style="text-align:center;color:var(--muted);font-size:12px;padding:12px">Caricamento team...</div>`;

  try {
  const { data: members } = await window.mySupabase.rpc('get_team_coaches');
  const { data: invites } = await window.mySupabase
  .from('coach_invitations')
  .select('*')
  .order('created_at', { ascending: false })
  .limit(10);

  const roleLabel = { head: 'Head Coach', assistant: 'Assistente', viewer: 'Viewer' };
  const roleColor = { head: 'var(--teal)', assistant: '#60a5fa', viewer: 'var(--muted)' };

  const memberRows = (members || []).map(m => `
  <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--border)">
  <div>
  <div style="font-size:13px;font-weight:700;color:var(--text)">${escHtml(m.email)}</div>
  <div style="font-size:10px;color:${roleColor[m.coach_role] || 'var(--muted)'};margin-top:2px;font-weight:700">
  ${roleLabel[m.coach_role] || m.coach_role}
  </div>
  </div>
  <div style="font-size:10px;color:var(--muted)">${m.created_at?.slice(0,10) || ''}</div>
  </div>`).join('');

  const pendingInvites = (invites || []).filter(i => !i.accepted && new Date(i.expires_at) > new Date());
  const inviteRows = pendingInvites.map(i => `
  <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border)">
  <div>
  <div style="font-size:12px;color:var(--muted)">${escHtml(i.email)}</div>
  <div style="font-size:10px;color:var(--amber);margin-top:1px"> Invito pendente — scade ${i.expires_at?.slice(0,10)}</div>
  </div>
  <button onclick="revokeInvite('${i.id}')" style="font-size:10px;padding:3px 8px;background:var(--coral-d);border:1px solid var(--coral);border-radius:6px;color:var(--coral);cursor:pointer">Revoca</button>
  </div>`).join('');

  el.innerHTML = `
  <div class="card" style="border:1px solid var(--border)">
  <div class="card-t" style="margin-bottom:14px"> Il mio team — ${(members||[]).length} coach</div>
  ${memberRows || '<div style="color:var(--muted);font-size:12px;padding:8px 0">Nessun membro nel team ancora.</div>'}

  ${pendingInvites.length ? `
  <div style="margin-top:14px">
  <div style="font-size:10px;color:var(--muted);font-weight:700;letter-spacing:.06em;margin-bottom:8px">INVITI PENDENTI</div>
  ${inviteRows}
  </div>` : ''}

  <div style="margin-top:16px;padding-top:14px;border-top:1px solid var(--border)">
  <div style="font-size:12px;font-weight:700;color:var(--text);margin-bottom:8px">Invita coach assistente</div>
  <div style="display:flex;gap:8px;align-items:center">
  <input type="email" id="invite-email-input" placeholder="email@coach.com"
  style="flex:1;padding:8px 12px;background:var(--s2);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:12px">
  <select id="invite-role-select" style="padding:8px;background:var(--s2);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:12px">
  <option value="assistant">Assistente</option>
  <option value="viewer">Viewer</option>
  </select>
  <button onclick="sendTeamInvite()" class="btn btn-p" style="white-space:nowrap;font-size:12px">Invita →</button>
  </div>
  <p style="font-size:10px;color:var(--muted);margin-top:8px">L'assistente riceverà il link di accesso via email. Puoi avere fino a 3 coach nel piano Team.</p>
  </div>
  </div>`;
  } catch (e) {
  el.innerHTML = `<div style="color:var(--coral);font-size:12px;padding:12px">Errore caricamento team: ${e.message}</div>`;
  }
}


// ─────────────────────────────────────────────────────────────
// sendTeamInvite — crea invito nel DB e mostra link
// ─────────────────────────────────────────────────────────────
export async function sendTeamInvite() {
  const email = document.getElementById('invite-email-input')?.value.trim();
  const role = document.getElementById('invite-role-select')?.value || 'assistant';

  if (!email || !email.includes('@')) { toast('Inserisci un indirizzo email valido'); return; }
  if (!window.mySupabase) { toast(' Connessione non disponibile'); return; }

  const { data: user } = await window.mySupabase.auth.getUser();
  if (!user.user) { toast(' Non autenticato'); return; }

  const { data: invite, error } = await window.mySupabase
  .from('coach_invitations')
  .upsert([{ head_coach_id: user.user.id, email, role }], { onConflict: 'head_coach_id,email' })
  .select('token')
  .single();

  if (error) { toast(' ' + error.message); return; }

  const acceptUrl = `${window.location.origin}/?accept_invite=${invite.token}`;
  toast(' Invito creato — copia il link e invialo al coach');

  // Mostra il link in un alert copiabile
  const el = document.getElementById('invite-email-input');
  if (el) el.value = '';

  const linkDiv = document.createElement('div');
  linkDiv.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:99999;background:var(--s2);border:1px solid var(--teal);border-radius:12px;padding:20px;max-width:360px;width:90vw';
  linkDiv.innerHTML = `
  <div style="font-weight:800;color:var(--teal);margin-bottom:8px"> Link invito creato</div>
  <div style="font-size:11px;color:var(--muted);margin-bottom:10px">Invia questo link a <strong>${escHtml(email)}</strong>:<br>Valido 7 giorni.</div>
  <input readonly value="${acceptUrl}" id="invite-link-field"
  style="width:100%;padding:8px;background:var(--s1);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:11px;box-sizing:border-box;font-family:var(--fm)">
  <div style="display:flex;gap:8px;margin-top:10px">
  <button onclick="navigator.clipboard.writeText('${acceptUrl}').then(()=>document.getElementById('invite-copy-btn').textContent='✓ Copiato!')" id="invite-copy-btn"
  style="flex:1;padding:8px;background:var(--teal);border:none;border-radius:8px;color:#fff;font-weight:700;cursor:pointer;font-size:12px">
  Copia link
  </button>
  <button onclick="this.closest('div[style*=fixed]').remove()"
  style="padding:8px 12px;background:var(--s1);border:1px solid var(--border);border-radius:8px;color:var(--muted);cursor:pointer;font-size:12px">
  Chiudi
  </button>
  </div>`;
  document.body.appendChild(linkDiv);

  await renderTeamPanel('team-panel-container');
}


// ─────────────────────────────────────────────────────────────
// revokeInvite — elimina un invito pendente
// ─────────────────────────────────────────────────────────────
export async function revokeInvite(inviteId) {
  if (!window.mySupabase) return;
  const { error } = await window.mySupabase.from('coach_invitations').delete().eq('id', inviteId);
  if (error) { toast(' ' + error.message); return; }
  toast('Invito revocato');
  await renderTeamPanel('team-panel-container');
}


// ─────────────────────────────────────────────────────────────
// checkAndAcceptInvite — controlla URL param al caricamento
// ─────────────────────────────────────────────────────────────
export async function checkAndAcceptInvite() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('accept_invite');
  if (!token) return;

  window.history.replaceState({}, '', window.location.pathname);

  if (!window.mySupabase) { toast(' Connessione non disponibile per accettare l\'invito'); return; }

  const { data, error } = await window.mySupabase.rpc('accept_team_invitation', { p_token: token });
  if (error || data === 'invalid_or_expired') {
  toast(' Link invito non valido o scaduto');
  } else {
  toast(' Sei entrato nel team! Ricarica l\'app.');
  setTimeout(() => window.location.reload(), 2000);
  }
}

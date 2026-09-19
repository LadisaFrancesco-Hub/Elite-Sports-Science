/* ══════════════════════════════════════════════════════════════
   ELITE SPORTS SCIENCE — library.js
   Exercise Library Browser: ricerca, categorie, video thumbnails
   ══════════════════════════════════════════════════════════════ */

import { EXERCISE_LIBRARY, appState } from './state.js';
import { toast } from './utils.js';

// ─────────────────────────────────────────────────────────────
// CATEGORIE
// ─────────────────────────────────────────────────────────────
const CATS = [
    { key: 'all',          label: 'Tutti'           },
    { key: 'push',         label: 'Compound Push'   },
    { key: 'pull',         label: 'Compound Pull'   },
    { key: 'legs',         label: 'Gambe'           },
    { key: 'hinge',        label: 'Hinge'           },
    { key: 'olympic',      label: 'Olimpici'        },
    { key: 'isolation',    label: 'Isolamento'      },
    { key: 'core',         label: 'Core'            },
    { key: 'mobility',     label: 'Mobilità'        },
    { key: 'conditioning', label: 'Condizionamento' },
];

const CAT_MAP = {
    bench_press_bb:'push', chest_press:'push', incline_bb:'push', incline_db:'push',
    db_bench_30:'push', db_bench_flat:'push', shoulder_press:'push', ohp_bb:'push',
    arnold_press:'push', dips_chest:'push', push_up:'push', push_up_std:'push', landmine_press:'push',
    decline_bench:'push', decline_db:'push', close_grip_bench:'push',
    db_shoulder_press:'push', machine_shoulder_press:'push', diamond_push_up:'push',
    floor_press:'push', cable_chest_press:'push', ring_push_up:'push',
    pike_push_up:'push', z_press:'push', svend_press:'push',
    jm_press:'push', board_press:'push', db_floor_press:'push',
    incline_cable_press:'push', wide_push_up:'push', low_incline_db:'push',

    lat_machine:'pull', pull_up:'pull', chin_up:'pull', bb_row:'pull',
    cable_row_60:'pull', cable_row:'pull', landmine_row:'pull', db_row:'pull',
    tbar_row:'pull', chest_supp_row:'pull', seal_row:'pull',
    lat_pulldown_neutral:'pull', lat_pulldown_narrow:'pull', neutral_pullup:'pull',
    inverted_row:'pull', machine_row:'pull', high_row:'pull',
    pendlay_row:'pull', meadows_row:'pull', ez_bar_row:'pull',
    cable_pullover:'pull', single_arm_lat:'pull', dead_hang:'pull',
    archer_row:'pull', underhand_row:'pull', wide_grip_pullup:'pull',
    w_pull:'pull', renegade_row:'pull', face_pull_band:'pull',

    back_squat:'legs', front_squat:'legs', goblet_squat:'legs', hack_squat:'legs',
    leg_press:'legs', sumo_squat:'legs', bulgarian_lunges:'legs', back_lunges:'legs',
    walking_lunges:'legs', reverse_lunge:'legs', step_up:'legs', box_jump:'legs',
    broad_jump:'legs', leg_curl:'legs', nordic_curl:'legs', leg_ext:'legs',
    calf_raise:'legs', seated_calf:'legs', tibialis_raise:'legs',
    box_squat:'legs', split_squat:'legs', lateral_lunge:'legs', single_leg_press:'legs',
    hip_abduction:'legs', hip_adduction:'legs', cable_kickback:'legs',
    single_leg_calf:'legs', standing_leg_curl:'legs', sissy_squat:'legs',
    safety_bar_squat:'legs', zercher_squat:'legs', leg_press_calf:'legs',
    tke:'legs', single_leg_ext:'legs', paused_squat:'legs',
    wall_squat:'legs', reverse_nordic:'legs',
    cyclist_squat:'legs', hatfield_squat:'legs', anderson_squat:'legs',
    donkey_calf:'legs', cable_leg_curl:'legs', leg_press_wide:'legs',
    glute_kickback_mach:'legs', lying_leg_curl:'legs',

    deadlift:'hinge', sumo_deadlift:'hinge', trap_bar:'hinge', bb_rdl:'hinge',
    db_rdl:'hinge', single_rdl:'hinge', good_morning:'hinge', hip_thrust:'hinge',
    bb_hip_thrust:'hinge', glute_bridge:'hinge', kb_swing:'hinge',
    single_leg_hip_thrust:'hinge', cable_pull_through:'hinge',
    ghd_hip_ext:'hinge', kb_deadlift:'hinge',
    stiff_leg_dl:'hinge', banded_hip_thrust:'hinge',
    back_ext_45:'hinge', snatch_grip_dl:'hinge',
    deficit_deadlift:'hinge', rack_pull:'hinge', b_stance_rdl:'hinge', paused_deadlift:'hinge',

    power_clean:'olympic', hang_clean:'olympic', power_snatch:'olympic', push_press:'olympic',
    push_jerk:'olympic', med_ball_slam:'olympic', med_ball_throw:'olympic',
    jump_squat:'olympic', depth_jump:'olympic', sled_push:'olympic', sled_pull:'olympic',
    hang_snatch:'olympic', clean_pull:'olympic', split_jerk:'olympic',
    mb_chest_pass:'olympic', mb_rotational:'olympic',
    continuous_box_jump:'olympic', hurdle_jump:'olympic', horizontal_bound:'olympic',
    muscle_clean:'olympic', hang_power_clean:'olympic', power_jerk:'olympic',
    triple_broad_jump:'olympic', single_leg_hop:'olympic', reactive_drop_jump:'olympic',
    full_clean:'olympic', full_snatch:'olympic', overhead_squat:'olympic',
    db_snatch:'olympic', snatch_balance:'olympic', clean_jerk:'olympic',

    pec_fly:'isolation', cable_fly:'isolation', cable_fly_low:'isolation', cable_fly_high:'isolation',
    lateral_raises:'isolation', cable_delt:'isolation', front_raises:'isolation',
    face_pull:'isolation', rear_delt_fly:'isolation', upright_row:'isolation',
    shrug:'isolation', cable_shrug:'isolation',
    lateral_raise_machine:'isolation', rear_delt_machine:'isolation',
    db_shrug:'isolation', bent_over_lateral:'isolation',
    straight_arm_pd:'isolation', pullover:'isolation', hyperextension:'isolation', reverse_hyper:'isolation',
    bb_curl:'isolation', curl_db_45:'isolation', hammer_curl:'isolation', preacher_curl:'isolation',
    incline_curl:'isolation', cable_curl:'isolation', spider_curl:'isolation', zottman_curl:'isolation',
    concentration_curl:'isolation', ez_bar_curl:'isolation', reverse_curl:'isolation',
    bayesian_curl:'isolation', drag_curl:'isolation',
    push_down:'isolation', overhead_ext:'isolation', french_press:'isolation', skull_crusher:'isolation',
    db_kickback:'isolation', dips_tri:'isolation', cable_overhead_t:'isolation',
    rope_pushdown:'isolation', single_arm_pushdown:'isolation',
    wrist_curl:'isolation', reverse_wrist_curl:'isolation', cable_lateral_raise:'isolation',
    pec_dec:'isolation', serratus_crunch:'isolation', long_head_pushdown:'isolation',
    hip_flexor_raise:'isolation', neck_flexion:'isolation', neck_extension:'isolation',
    wrist_roller:'isolation', y_raise:'isolation', ext_rotation_cable:'isolation',

    crunch_cable:'core', bicycle_crunch:'core', hanging_leg_raise:'core', ab_wheel:'core',
    plank:'core', side_plank:'core', pallof_press:'core', dead_bug:'core',
    russian_twist:'core', cable_wood_chop:'core', v_up:'core', toes_bar:'core',
    ghd_situp:'core', dragon_flag:'core',
    hollow_hold:'core', leg_raise_bench:'core', l_sit:'core',
    copenhagen_plank:'core', hanging_windshield:'core',
    stir_pot:'core', bb_rollout:'core', landmine_rotation:'core',
    trx_fallout:'core', suitcase_deadlift:'core', loaded_carry_core:'core',
    spiderman_plank:'core', jefferson_curl:'core', reverse_crunch:'core',
    oblique_crunch:'core', ghr:'core', weighted_plank:'core',

    hip_hinge:'mobility', bird_dog:'mobility', cat_cow:'mobility', world_greatest:'mobility',
    ankle_mob:'mobility', hip_flex_stretch:'mobility', thoracic_rotation:'mobility',
    band_pull_apart:'mobility', scapular_pullup:'mobility', Cuban_rotation:'mobility',
    couch_stretch:'mobility', hip_90_90:'mobility', squat_to_stand:'mobility',
    cossack_squat:'mobility', foam_roller_thoracic:'mobility', wall_hip_flexor:'mobility',
    pigeon_stretch:'mobility', shoulder_dislocates:'mobility', deep_squat_hold:'mobility',
    hamstring_floss:'mobility', pec_doorway:'mobility', ankle_calf_stretch:'mobility',
    hip_circle:'mobility', figure_four:'mobility', lat_stretch:'mobility',
    neck_mob:'mobility', wrist_ext_stretch:'mobility', prone_hip_ext:'mobility',

    sprint_10:'conditioning', sprint_20:'conditioning', sprint_30:'conditioning', sprint_40:'conditioning',
    tempo_run_200:'conditioning', tempo_run_400:'conditioning', agility_5_10_5:'conditioning',
    t_test:'conditioning', pro_agility:'conditioning', ladder_drill:'conditioning',
    cone_drill:'conditioning', farmer_carry:'conditioning', yoke_carry:'conditioning',
    battle_ropes:'conditioning', row_machine:'conditioning', assault_bike:'conditioning',
    ski_erg:'conditioning', bike_sprint:'conditioning',
    sprint_60:'conditioning', fly_sprint:'conditioning', a_skip:'conditioning',
    b_skip:'conditioning', illinois_agility:'conditioning', jump_rope:'conditioning',
    burpee:'conditioning', wall_ball:'conditioning', sandbag_carry:'conditioning',
    overhead_carry:'conditioning', suitcase_carry:'conditioning', bear_crawl:'conditioning',
    resisted_sprint:'conditioning', tuck_jump:'conditioning', bounding:'conditioning',
    stair_sprint:'conditioning', kb_complex:'conditioning', prowler_push:'conditioning',
    tire_flip:'conditioning', slam_ball:'conditioning',
    hill_sprint:'conditioning', shuttle_run:'conditioning', altitude_drop:'conditioning',
    rowing_interval:'conditioning', cycling_interval:'conditioning', kb_snatch:'conditioning',
    db_complex:'conditioning', rope_climb:'conditioning',
};

// ─────────────────────────────────────────────────────────────
// Estrae YouTube video ID da qualsiasi formato URL
// ─────────────────────────────────────────────────────────────
function ytId(url) {
    if (!url) return null;
    try {
        const u = new URL(url);
        if (u.hostname === 'youtu.be') return u.pathname.slice(1).split('?')[0];
        if (u.hostname.includes('youtube.com')) return u.searchParams.get('v') || u.pathname.split('/').pop();
    } catch (_) {}
    return url;
}

// ─────────────────────────────────────────────────────────────
// Stato locale — resettato ad ogni apertura del pannello
// ─────────────────────────────────────────────────────────────
let _activeCat = 'all';
let _searchQ   = '';

// ─────────────────────────────────────────────────────────────
// renderExerciseLibrary — entry point chiamato da go()
// ─────────────────────────────────────────────────────────────
export function renderExerciseLibrary() {
    const panel = document.getElementById('p-libreria');
    if (!panel) return;

    _activeCat = 'all';
    _searchQ   = '';

    panel.innerHTML = `
        <div class="ph">Libreria Esercizi</div>
        <div class="ps">${EXERCISE_LIBRARY.length} movimenti — video tutorial integrati</div>

        <div style="display:flex;gap:8px;margin-bottom:12px;">
            <input id="lib-search" type="search" placeholder="Cerca esercizio..." autocomplete="off"
                style="flex:1;padding:9px 14px;background:var(--s2);border:1px solid var(--border);
                       border-radius:var(--radius);color:var(--text);font-size:13px;outline:none;
                       transition:border-color .15s;"
                onfocus="this.style.borderColor='var(--teal)'"
                onblur="this.style.borderColor='var(--border)'"
                oninput="window._libSearch(this.value)">
        </div>

        <div style="display:flex;gap:6px;overflow-x:auto;padding-bottom:10px;margin-bottom:12px;scrollbar-width:none;-webkit-overflow-scrolling:touch;">
            ${CATS.map(c => _catBtn(c, c.key === 'all')).join('')}
        </div>

        <div id="lib-count" style="font-size:10px;color:var(--dim);margin-bottom:12px;font-family:var(--fmono);letter-spacing:.04em;">
            ${EXERCISE_LIBRARY.length} ESERCIZI
        </div>

        <div id="lib-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(155px,1fr));gap:10px;padding-bottom:100px;">
        </div>
    `;

    _renderGrid();

    window._libSearch = (q) => {
        _searchQ = q.toLowerCase().trim();
        _renderGrid();
    };

    window._libCat = (key) => {
        _activeCat = key;
        CATS.forEach(c => {
            const btn = document.getElementById('lcat-' + c.key);
            if (!btn) return;
            const on = c.key === key;
            btn.style.borderColor = on ? 'var(--teal)' : 'rgba(255,255,255,.08)';
            btn.style.background  = on ? 'var(--teal-d)' : 'transparent';
            btn.style.color       = on ? 'var(--teal)' : 'var(--dim)';
        });
        _renderGrid();
    };

    window._libAddEx = (exId) => {
        const ex = EXERCISE_LIBRARY.find(e => e.id === exId);
        if (!ex) return;

        if (!appState.selAthId || !appState.edSessId) {
            toast('Apri prima l\'Editor schede e seleziona una sessione');
            return;
        }

        const exs = window.getEdExercises?.();
        if (!exs) { toast('Errore: editor non disponibile'); return; }

        exs.push({
            name:          ex.name,
            type:          'repetition',
            arm:           'Bi',
            wset:          1,
            set:           3,
            rep:           '8',
            kg:            0,
            rir:           '2',
            rest:          "90''",
            tut:           '-',
            note:          '',
            ytUrl:         ex.ytUrl,
            rpe:           '',
            trackE1rm:     ex.trackE1rm,
            anatomicalZone: ex.anatomicalZone,
            section:       'centrale',
        });

        window.renderEdExercises?.();
        window.updatePredictiveACWR?.();

        toast(`✅ "${ex.name}" aggiunto alla sessione`);
    };
}

function _catBtn(c, active) {
    return `<button id="lcat-${c.key}" onclick="window._libCat('${c.key}')"
        style="flex-shrink:0;padding:5px 13px;border-radius:99px;cursor:pointer;white-space:nowrap;
               font-size:11px;font-weight:700;letter-spacing:.03em;font-family:var(--fmono);
               transition:all .15s;
               border:1px solid ${active ? 'var(--teal)' : 'rgba(255,255,255,.08)'};
               background:${active ? 'var(--teal-d)' : 'transparent'};
               color:${active ? 'var(--teal)' : 'var(--dim)'};">
        ${c.label}
    </button>`;
}

// ─────────────────────────────────────────────────────────────
// _renderGrid — filtra e disegna le card
// ─────────────────────────────────────────────────────────────
function _renderGrid() {
    const grid  = document.getElementById('lib-grid');
    const count = document.getElementById('lib-count');
    if (!grid) return;

    const filtered = EXERCISE_LIBRARY.filter(ex => {
        const matchCat  = _activeCat === 'all' || CAT_MAP[ex.id] === _activeCat;
        const matchName = !_searchQ || ex.name.toLowerCase().includes(_searchQ);
        return matchCat && matchName;
    });

    if (count) count.textContent = `${filtered.length} ESERCIZI`;

    if (!filtered.length) {
        grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:48px 20px;color:var(--dim);font-size:13px;">
            Nessun esercizio trovato per "<em>${_searchQ}</em>"
        </div>`;
        return;
    }

    grid.innerHTML = filtered.map(ex => _card(ex)).join('');
}

function _card(ex) {
    const vid      = ytId(ex.ytUrl);
    const thumb    = vid ? `https://img.youtube.com/vi/${vid}/mqdefault.jpg` : null;
    const cat      = CATS.find(c => c.key === (CAT_MAP[ex.id] || 'all'));
    const safeTitle = ex.name.replace(/'/g, "\\'").replace(/"/g, '&quot;');
    const safeUrl   = (ex.ytUrl || '').replace(/'/g, "\\'");
    const isCoach   = window.userRole !== 'ATLETA';

    return `
        <div style="position:relative;background:var(--s2);border:1px solid var(--border);border-radius:var(--radius);
                    overflow:hidden;cursor:pointer;transition:border-color .15s,transform .1s;"
             onmouseenter="this.style.borderColor='var(--teal)';this.style.transform='translateY(-1px)'"
             onmouseleave="this.style.borderColor='var(--border)';this.style.transform='none'"
             onclick="openVideoModal('${safeUrl}','${safeTitle}')">

            <!-- Thumbnail 16:9 -->
            <div style="position:relative;width:100%;padding-top:56.25%;background:var(--s3);overflow:hidden;">
                ${thumb ? `
                    <img src="${thumb}" alt="${ex.name}" loading="lazy"
                        style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.8;"
                        onerror="this.style.display='none'">
                ` : ''}
                <!-- Overlay play button -->
                <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;">
                    <div style="width:38px;height:38px;border-radius:50%;
                                background:rgba(0,0,0,.55);backdrop-filter:blur(4px);
                                display:flex;align-items:center;justify-content:center;
                                border:1.5px solid rgba(255,255,255,.25);">
                        <span style="color:#fff;font-size:13px;margin-left:2px;">▶</span>
                    </div>
                </div>
                <!-- e1RM badge -->
                ${ex.trackE1rm ? `
                    <div style="position:absolute;top:6px;left:6px;font-size:8px;font-weight:700;
                                padding:2px 5px;border-radius:4px;
                                background:oklch(0.82 0.13 88 / .85);color:#0A0C0F;
                                font-family:var(--fmono);letter-spacing:.04em;">
                        e1RM
                    </div>
                ` : ''}
            </div>

            <!-- Info -->
            <div style="padding:9px 10px ${isCoach ? '32px' : '11px'};">
                <div style="font-size:12px;font-weight:700;color:var(--text);line-height:1.3;margin-bottom:6px;">
                    ${ex.name}
                </div>
                <div style="display:flex;gap:4px;flex-wrap:wrap;">
                    ${cat && cat.key !== 'all' ? `
                        <span style="font-size:9px;font-weight:700;padding:2px 6px;border-radius:3px;
                                     background:var(--teal-d);color:var(--teal);
                                     font-family:var(--fmono);letter-spacing:.04em;">
                            ${cat.label}
                        </span>
                    ` : ''}
                    ${ex.anatomicalZone ? `
                        <span style="font-size:9px;font-weight:600;padding:2px 6px;border-radius:3px;
                                     background:var(--s3);color:var(--dim);font-family:var(--fmono);">
                            ${ex.anatomicalZone}
                        </span>
                    ` : ''}
                </div>
            </div>

            <!-- Bottone + (solo coach) -->
            ${isCoach ? `
                <button
                    onclick="event.stopPropagation(); window._libAddEx('${ex.id}')"
                    title="Aggiungi alla sessione corrente nell'editor"
                    style="position:absolute;bottom:8px;right:8px;
                           width:26px;height:26px;border-radius:6px;
                           background:var(--teal-d);border:1px solid var(--teal);
                           color:var(--teal);font-size:18px;font-weight:700;line-height:1;
                           cursor:pointer;display:flex;align-items:center;justify-content:center;">
                    +
                </button>
            ` : ''}
        </div>
    `;
}

/* ══════════════════════════════════════════════════════════════
   ELITE SPORTS SCIENCE — state.js
   Unica fonte di verità per lo stato condiviso.
   Nessun import: tutti gli altri moduli importano da qui.
   ══════════════════════════════════════════════════════════════ */

// ─────────────────────────────────────────────────────────────
// COSTANTI
// ─────────────────────────────────────────────────────────────
export const KEY = 'coachOS_v3';

export const rpeDescs  = { 6:'Recupero leggero', 7:'Fatica moderata', 8:'Impegnativo (2 RIR)', 9:'Molto duro (1 RIR)', 10:'Massimale / Cedimento' };
export const starDescs = { 1:'Pessima', 2:'Sotto tono', 3:'Standard', 4:'Molto buona', 5:'Eccezionale' };

// ytUrl: URL YouTube per il video tutorial (aperto nel modal in-app)
// anatomicalZone: zona anatomica per il sistema infortuni
export const EXERCISE_LIBRARY = [
    // ── COMPOUND PUSH ────────────────────────────────────────
    { id: 'bench_press_bb',    name: 'Bench Press Bilanciere',           trackE1rm: true,  anatomicalZone: 'shoulders', ytUrl: 'https://youtu.be/gRVjAtPip0Y' },
    { id: 'chest_press',       name: 'Chest Press',                      trackE1rm: true,  anatomicalZone: 'shoulders', ytUrl: 'https://youtu.be/xUm0BiZCWlQ' },
    { id: 'incline_bb',        name: 'Incline Bench Press Bilanciere',   trackE1rm: true,  anatomicalZone: 'shoulders', ytUrl: 'https://youtu.be/DbFgADa2PL8' },
    { id: 'incline_db',        name: 'Incline DB Bench Press',           trackE1rm: true,  anatomicalZone: 'shoulders', ytUrl: 'https://youtu.be/8iPEnn-ltC8' },
    { id: 'db_bench_30',       name: 'DB Bench Press Panca 30',          trackE1rm: true,  anatomicalZone: 'shoulders', ytUrl: '' },
    { id: 'db_bench_flat',     name: 'DB Bench Press Flat',              trackE1rm: true,  anatomicalZone: 'shoulders', ytUrl: 'https://youtu.be/QsYre__-aro' },
    { id: 'shoulder_press',    name: 'Shoulder Press',                   trackE1rm: true,  anatomicalZone: 'shoulders', ytUrl: 'https://youtu.be/qEwKCR5JCog' },
    { id: 'ohp_bb',            name: 'Overhead Press Bilanciere',        trackE1rm: true,  anatomicalZone: 'shoulders', ytUrl: 'https://youtu.be/2yjwXTZQDDI' },
    { id: 'arnold_press',      name: 'Arnold Press',                     trackE1rm: true,  anatomicalZone: 'shoulders', ytUrl: 'https://youtu.be/K-bFEMWOiGk' },
    { id: 'dips_chest',        name: 'Dips (Petto)',                     trackE1rm: true,  anatomicalZone: 'shoulders', ytUrl: 'https://youtu.be/2z8JmcrW-As' },
    { id: 'push_up',           name: 'Elevated Push Up',                 trackE1rm: false, anatomicalZone: 'shoulders', ytUrl: 'https://youtu.be/IODxDxX7oi4' },
    { id: 'push_up_std',       name: 'Push Up',                          trackE1rm: false, anatomicalZone: 'shoulders', ytUrl: 'https://youtu.be/IODxDxX7oi4' },
    { id: 'landmine_press',    name: 'Landmine Press',                   trackE1rm: true,  anatomicalZone: 'shoulders', ytUrl: 'https://youtu.be/DpRDgVRRdtk' },

    // ── COMPOUND PULL ────────────────────────────────────────
    { id: 'lat_machine',       name: 'Lat Machine',                      trackE1rm: true,  anatomicalZone: 'shoulders', ytUrl: 'https://youtu.be/CAwf7n6Luuc' },
    { id: 'pull_up',           name: 'Pull Up',                          trackE1rm: true,  anatomicalZone: 'shoulders', ytUrl: 'https://youtu.be/eGo4IYlbE5g' },
    { id: 'chin_up',           name: 'Chin Up',                          trackE1rm: true,  anatomicalZone: 'shoulders', ytUrl: 'https://youtu.be/brhRXlOhsAM' },
    { id: 'bb_row',            name: 'Barbell Row',                      trackE1rm: true,  anatomicalZone: 'lowerback',  ytUrl: 'https://youtu.be/T3N-TO4reLQ' },
    { id: 'cable_row_60',      name: 'Single Arm Cable Row Panca 60',    trackE1rm: true,  anatomicalZone: 'shoulders', ytUrl: '' },
    { id: 'cable_row',         name: 'Cable Row Seduto',                 trackE1rm: true,  anatomicalZone: 'shoulders', ytUrl: 'https://youtu.be/GZbfZ033f74' },
    { id: 'landmine_row',      name: 'Landmine Single Arm Row',          trackE1rm: true,  anatomicalZone: 'shoulders', ytUrl: 'https://youtu.be/kO_fGDWDN_I' },
    { id: 'db_row',            name: 'DB One Arm Row',                   trackE1rm: true,  anatomicalZone: 'shoulders', ytUrl: 'https://youtu.be/pYcpY20QaE8' },
    { id: 'tbar_row',          name: 'T-Bar Row',                        trackE1rm: true,  anatomicalZone: 'lowerback',  ytUrl: 'https://youtu.be/j3Igk5nyZE4' },
    { id: 'chest_supp_row',    name: 'Chest Supported DB Row',           trackE1rm: true,  anatomicalZone: 'shoulders', ytUrl: 'https://youtu.be/ewh5_eQBPmo' },
    { id: 'seal_row',          name: 'Seal Row',                         trackE1rm: true,  anatomicalZone: 'lowerback',  ytUrl: 'https://youtu.be/HaOgVbHf8BQ' },

    // ── LEGACCI / GAMBE ──────────────────────────────────────
    { id: 'back_squat',        name: 'Back Squat',                       trackE1rm: true,  anatomicalZone: 'knees',      ytUrl: 'https://youtu.be/bEv6CCg2BC8' },
    { id: 'front_squat',       name: 'Front Squat',                      trackE1rm: true,  anatomicalZone: 'knees',      ytUrl: 'https://youtu.be/m4ytaCJZpl0' },
    { id: 'goblet_squat',      name: 'Goblet Squat',                     trackE1rm: true,  anatomicalZone: 'knees',      ytUrl: 'https://youtu.be/MxsFDhcyFyE' },
    { id: 'hack_squat',        name: 'Hack Squat',                       trackE1rm: true,  anatomicalZone: 'knees',      ytUrl: 'https://youtu.be/EdtPQQfPKZA' },
    { id: 'leg_press',         name: 'Leg Press 45',                     trackE1rm: true,  anatomicalZone: 'knees',      ytUrl: 'https://youtu.be/YyvSfVjQeL0' },
    { id: 'sumo_squat',        name: 'Sumo Squat',                       trackE1rm: true,  anatomicalZone: 'knees',      ytUrl: 'https://youtu.be/9-CSkY7LGzw' },
    { id: 'bulgarian_lunges',  name: 'Bulgarian Lunges',                 trackE1rm: true,  anatomicalZone: 'knees',      ytUrl: 'https://youtu.be/2C-uNgKwPLE' },
    { id: 'back_lunges',       name: 'Back Lunges',                      trackE1rm: true,  anatomicalZone: 'knees',      ytUrl: 'https://youtu.be/QOVaHwm-Q6U' },
    { id: 'walking_lunges',    name: 'Walking Lunges',                   trackE1rm: false, anatomicalZone: 'knees',      ytUrl: 'https://youtu.be/L8fvypPrzzs' },
    { id: 'reverse_lunge',     name: 'Reverse Lunge',                    trackE1rm: true,  anatomicalZone: 'knees',      ytUrl: 'https://youtu.be/xrPteyQLGAo' },
    { id: 'step_up',           name: 'Step Up Single Leg',               trackE1rm: true,  anatomicalZone: 'knees',      ytUrl: 'https://youtu.be/WCFCdxzFBa4' },
    { id: 'box_jump',          name: 'Box Jump',                         trackE1rm: false, anatomicalZone: 'knees',      ytUrl: 'https://youtu.be/52r_Ul5k03g' },
    { id: 'broad_jump',        name: 'Broad Jump',                       trackE1rm: false, anatomicalZone: 'knees',      ytUrl: '' },
    { id: 'leg_curl',          name: 'Leg Curl',                         trackE1rm: false, anatomicalZone: 'knees',      ytUrl: 'https://youtu.be/1Tq3QdYUuHs' },
    { id: 'nordic_curl',       name: 'Nordic Curl',                      trackE1rm: false, anatomicalZone: 'knees',      ytUrl: 'https://youtu.be/4QhRSMEVaGU' },
    { id: 'leg_ext',           name: 'Leg Extension',                    trackE1rm: false, anatomicalZone: 'knees',      ytUrl: 'https://youtu.be/YyvSfVjQeL0' },
    { id: 'calf_raise',        name: 'Calf Raise',                       trackE1rm: false, anatomicalZone: 'ankles',     ytUrl: 'https://youtu.be/JbyjNymZOt0' },
    { id: 'seated_calf',       name: 'Seated Calf Raise',                trackE1rm: false, anatomicalZone: 'ankles',     ytUrl: 'https://youtu.be/1Tq3QdYUuHs' },
    { id: 'tibialis_raise',    name: 'Tibialis Raise',                   trackE1rm: false, anatomicalZone: 'ankles',     ytUrl: '' },

    // ── HINGE / CATENA POSTERIORE ────────────────────────────
    { id: 'deadlift',          name: 'Stacco da Terra',                  trackE1rm: true,  anatomicalZone: 'lowerback',  ytUrl: 'https://youtu.be/AweC3UaM14o' },
    { id: 'sumo_deadlift',     name: 'Sumo Deadlift',                    trackE1rm: true,  anatomicalZone: 'lowerback',  ytUrl: 'https://youtu.be/Wr2j1TS2nM0' },
    { id: 'trap_bar',          name: 'Trap Bar Deadlift',                trackE1rm: true,  anatomicalZone: 'lowerback',  ytUrl: 'https://youtu.be/SqHvGSWfO1o' },
    { id: 'bb_rdl',            name: 'BB RDL',                           trackE1rm: true,  anatomicalZone: 'lowerback',  ytUrl: 'https://youtu.be/_oyxBCWCFrQ' },
    { id: 'db_rdl',            name: 'DB Romanian Deadlift',             trackE1rm: true,  anatomicalZone: 'lowerback',  ytUrl: 'https://youtu.be/JCXUYuzwNrM' },
    { id: 'single_rdl',        name: 'Single Leg RDL',                   trackE1rm: true,  anatomicalZone: 'lowerback',  ytUrl: 'https://youtu.be/mFaRGWfBGZs' },
    { id: 'good_morning',      name: 'Good Morning',                     trackE1rm: true,  anatomicalZone: 'lowerback',  ytUrl: 'https://youtu.be/a3NJBFhxP_I' },
    { id: 'hip_thrust',        name: 'Hip Thrust Machine',               trackE1rm: true,  anatomicalZone: 'lowerback',  ytUrl: 'https://youtu.be/LM8XHLYJoYs' },
    { id: 'bb_hip_thrust',     name: 'Hip Thrust Bilanciere',            trackE1rm: true,  anatomicalZone: 'lowerback',  ytUrl: 'https://youtu.be/LM8XHLYJoYs' },
    { id: 'glute_bridge',      name: 'Glute Bridge',                     trackE1rm: false, anatomicalZone: 'lowerback',  ytUrl: 'https://youtu.be/wPM8icPu6H8' },
    { id: 'kb_swing',          name: 'Kettlebell Swing',                 trackE1rm: false, anatomicalZone: 'lowerback',  ytUrl: 'https://youtu.be/o-E4YKpd9tw' },

    // ── OLIMPICI / POTENZA ───────────────────────────────────
    { id: 'power_clean',       name: 'Power Clean',                      trackE1rm: true,  anatomicalZone: 'shoulders', ytUrl: 'https://youtu.be/TnDcb1K07As' },
    { id: 'hang_clean',        name: 'Hang Power Clean',                 trackE1rm: true,  anatomicalZone: 'shoulders', ytUrl: 'https://youtu.be/WCFCdxzFBa4' },
    { id: 'power_snatch',      name: 'Power Snatch',                     trackE1rm: true,  anatomicalZone: 'shoulders', ytUrl: 'https://youtu.be/9-CSkY7LGzw' },
    { id: 'push_press',        name: 'Push Press',                       trackE1rm: true,  anatomicalZone: 'shoulders', ytUrl: 'https://youtu.be/SwJBHM-f7ss' },
    { id: 'push_jerk',         name: 'Push Jerk',                        trackE1rm: true,  anatomicalZone: 'shoulders', ytUrl: '' },
    { id: 'med_ball_slam',     name: 'Med Ball Slam',                    trackE1rm: false, anatomicalZone: 'lowerback',  ytUrl: '' },
    { id: 'med_ball_throw',    name: 'Med Ball Overhead Throw',          trackE1rm: false, anatomicalZone: 'shoulders', ytUrl: '' },
    { id: 'jump_squat',        name: 'Jump Squat',                       trackE1rm: false, anatomicalZone: 'knees',      ytUrl: '' },
    { id: 'depth_jump',        name: 'Depth Jump',                       trackE1rm: false, anatomicalZone: 'knees',      ytUrl: '' },
    { id: 'sled_push',         name: 'Sled Push',                        trackE1rm: false, anatomicalZone: 'knees',      ytUrl: '' },
    { id: 'sled_pull',         name: 'Sled Pull',                        trackE1rm: false, anatomicalZone: 'knees',      ytUrl: '' },

    // ── ISOLARE PETTO ────────────────────────────────────────
    { id: 'pec_fly',           name: 'Pec Fly',                          trackE1rm: false, anatomicalZone: 'shoulders', ytUrl: 'https://youtu.be/eozdVDA78K0' },
    { id: 'cable_fly',         name: 'Cable Fly',                        trackE1rm: false, anatomicalZone: 'shoulders', ytUrl: 'https://youtu.be/taI4XduLpTk' },
    { id: 'cable_fly_low',     name: 'Cable Fly Low-to-High',            trackE1rm: false, anatomicalZone: 'shoulders', ytUrl: '' },
    { id: 'cable_fly_high',    name: 'Cable Fly High-to-Low',            trackE1rm: false, anatomicalZone: 'shoulders', ytUrl: '' },

    // ── ISOLARE SPALLE ───────────────────────────────────────
    { id: 'lateral_raises',    name: 'Lateral Raises DB',                trackE1rm: false, anatomicalZone: 'shoulders', ytUrl: 'https://youtu.be/3VcKaXpzqRo' },
    { id: 'cable_delt',        name: 'Cable Delt Raises',                trackE1rm: false, anatomicalZone: 'shoulders', ytUrl: '' },
    { id: 'front_raises',      name: 'Front Raises DB',                  trackE1rm: false, anatomicalZone: 'shoulders', ytUrl: '' },
    { id: 'face_pull',         name: 'Face Pull',                        trackE1rm: false, anatomicalZone: 'shoulders', ytUrl: 'https://youtu.be/HSoHeSjvIdw' },
    { id: 'rear_delt_fly',     name: 'Rear Delt Fly',                    trackE1rm: false, anatomicalZone: 'shoulders', ytUrl: 'https://youtu.be/5UELLNoYNSE' },
    { id: 'upright_row',       name: 'Upright Row',                      trackE1rm: false, anatomicalZone: 'shoulders', ytUrl: '' },
    { id: 'shrug',             name: 'Shrug Bilanciere',                 trackE1rm: false, anatomicalZone: 'shoulders', ytUrl: '' },
    { id: 'cable_shrug',       name: 'Cable Shrug',                      trackE1rm: false, anatomicalZone: 'shoulders', ytUrl: '' },

    // ── ISOLARE SCHIENA ──────────────────────────────────────
    { id: 'straight_arm_pd',   name: 'Straight Arm Pulldown',            trackE1rm: false, anatomicalZone: 'shoulders', ytUrl: '' },
    { id: 'pullover',          name: 'DB Pullover',                      trackE1rm: false, anatomicalZone: 'shoulders', ytUrl: '' },
    { id: 'hyperextension',    name: 'Hyperextension',                   trackE1rm: false, anatomicalZone: 'lowerback',  ytUrl: '' },
    { id: 'reverse_hyper',     name: 'Reverse Hyperextension',           trackE1rm: false, anatomicalZone: 'lowerback',  ytUrl: '' },

    // ── ISOLARE BICIPITI ─────────────────────────────────────
    { id: 'bb_curl',           name: 'BB Curl',                          trackE1rm: false, anatomicalZone: 'elbows',     ytUrl: 'https://youtu.be/kwG2ipFRgfo' },
    { id: 'curl_db_45',        name: 'Curl DB Panca 45',                 trackE1rm: false, anatomicalZone: 'elbows',     ytUrl: '' },
    { id: 'hammer_curl',       name: 'Cable Hammer Curl',                trackE1rm: false, anatomicalZone: 'elbows',     ytUrl: 'https://youtu.be/TwD-YGVP4Bk' },
    { id: 'preacher_curl',     name: 'Preacher Curl',                    trackE1rm: false, anatomicalZone: 'elbows',     ytUrl: '' },
    { id: 'incline_curl',      name: 'Incline DB Curl',                  trackE1rm: false, anatomicalZone: 'elbows',     ytUrl: '' },
    { id: 'cable_curl',        name: 'Cable Curl',                       trackE1rm: false, anatomicalZone: 'elbows',     ytUrl: '' },
    { id: 'spider_curl',       name: 'Spider Curl',                      trackE1rm: false, anatomicalZone: 'elbows',     ytUrl: '' },
    { id: 'zottman_curl',      name: 'Zottman Curl',                     trackE1rm: false, anatomicalZone: 'elbows',     ytUrl: '' },

    // ── ISOLARE TRICIPITI ────────────────────────────────────
    { id: 'push_down',         name: 'Push Down Cavi',                   trackE1rm: false, anatomicalZone: 'elbows',     ytUrl: 'https://youtu.be/2-LAMcpzODU' },
    { id: 'overhead_ext',      name: 'Overhead Extension Cavi Bassi',    trackE1rm: false, anatomicalZone: 'elbows',     ytUrl: '' },
    { id: 'french_press',      name: 'French Press',                     trackE1rm: false, anatomicalZone: 'elbows',     ytUrl: '' },
    { id: 'skull_crusher',     name: 'Skull Crusher',                    trackE1rm: false, anatomicalZone: 'elbows',     ytUrl: '' },
    { id: 'db_kickback',       name: 'DB Tricep Kickback',               trackE1rm: false, anatomicalZone: 'elbows',     ytUrl: '' },
    { id: 'dips_tri',          name: 'Dips (Tricipiti)',                  trackE1rm: false, anatomicalZone: 'elbows',     ytUrl: '' },
    { id: 'cable_overhead_t',  name: 'Cable Overhead Tricep Extension',  trackE1rm: false, anatomicalZone: 'elbows',     ytUrl: '' },

    // ── CORE / ADDOME ────────────────────────────────────────
    { id: 'crunch_cable',      name: 'Weighted Crunch with Cable',       trackE1rm: false, anatomicalZone: '',            ytUrl: '' },
    { id: 'bicycle_crunch',    name: 'Bicycle Crunch',                   trackE1rm: false, anatomicalZone: '',            ytUrl: '' },
    { id: 'hanging_leg_raise', name: 'Hanging Leg Raise',                trackE1rm: false, anatomicalZone: '',            ytUrl: 'https://youtu.be/Pr1ieGZ5atk' },
    { id: 'ab_wheel',          name: 'Ab Wheel Rollout',                 trackE1rm: false, anatomicalZone: 'lowerback',   ytUrl: 'https://youtu.be/kwLZaXBwBgk' },
    { id: 'plank',             name: 'Plank',                            trackE1rm: false, anatomicalZone: 'lowerback',   ytUrl: 'https://youtu.be/pvIjcsm7ajU' },
    { id: 'side_plank',        name: 'Side Plank',                       trackE1rm: false, anatomicalZone: 'lowerback',   ytUrl: '' },
    { id: 'pallof_press',      name: 'Pallof Press',                     trackE1rm: false, anatomicalZone: 'lowerback',   ytUrl: 'https://youtu.be/qSBXFZwkfYQ' },
    { id: 'dead_bug',          name: 'Dead Bug',                         trackE1rm: false, anatomicalZone: 'lowerback',   ytUrl: '' },
    { id: 'russian_twist',     name: 'Russian Twist',                    trackE1rm: false, anatomicalZone: '',            ytUrl: '' },
    { id: 'cable_wood_chop',   name: 'Cable Woodchop',                   trackE1rm: false, anatomicalZone: '',            ytUrl: '' },
    { id: 'v_up',              name: 'V-Up',                             trackE1rm: false, anatomicalZone: '',            ytUrl: '' },
    { id: 'toes_bar',          name: 'Toes to Bar',                      trackE1rm: false, anatomicalZone: '',            ytUrl: '' },
    { id: 'ghd_situp',         name: 'GHD Sit-Up',                      trackE1rm: false, anatomicalZone: 'lowerback',   ytUrl: '' },
    { id: 'dragon_flag',       name: 'Dragon Flag',                      trackE1rm: false, anatomicalZone: 'lowerback',   ytUrl: '' },

    // ── MOBILITÀ / ATTIVAZIONE ───────────────────────────────
    { id: 'hip_hinge',         name: 'Hip Hinge (tecnica)',              trackE1rm: false, anatomicalZone: 'lowerback',   ytUrl: '' },
    { id: 'bird_dog',          name: 'Bird Dog',                         trackE1rm: false, anatomicalZone: 'lowerback',   ytUrl: '' },
    { id: 'cat_cow',           name: 'Cat-Cow',                          trackE1rm: false, anatomicalZone: 'lowerback',   ytUrl: '' },
    { id: 'world_greatest',    name: 'World Greatest Stretch',           trackE1rm: false, anatomicalZone: '',            ytUrl: '' },
    { id: 'ankle_mob',         name: 'Ankle Mobilization',               trackE1rm: false, anatomicalZone: 'ankles',      ytUrl: '' },
    { id: 'hip_flex_stretch',  name: 'Hip Flexor Stretch',               trackE1rm: false, anatomicalZone: '',            ytUrl: '' },
    { id: 'thoracic_rotation', name: 'Thoracic Rotation',                trackE1rm: false, anatomicalZone: '',            ytUrl: '' },
    { id: 'band_pull_apart',   name: 'Band Pull Apart',                  trackE1rm: false, anatomicalZone: 'shoulders',  ytUrl: '' },
    { id: 'scapular_pullup',   name: 'Scapular Pull Up',                 trackE1rm: false, anatomicalZone: 'shoulders',  ytUrl: '' },
    { id: 'Cuban_rotation',    name: 'Cuban Rotation',                   trackE1rm: false, anatomicalZone: 'shoulders',  ytUrl: '' },

    // ── CAMPO / CONDIZIONAMENTO ──────────────────────────────
    { id: 'sprint_10',         name: 'Sprint 10m',                       trackE1rm: false, anatomicalZone: '',            ytUrl: '' },
    { id: 'sprint_20',         name: 'Sprint 20m',                       trackE1rm: false, anatomicalZone: '',            ytUrl: '' },
    { id: 'sprint_30',         name: 'Sprint 30m',                       trackE1rm: false, anatomicalZone: '',            ytUrl: '' },
    { id: 'sprint_40',         name: 'Sprint 40m',                       trackE1rm: false, anatomicalZone: '',            ytUrl: '' },
    { id: 'tempo_run_200',     name: 'Tempo Run 200m',                   trackE1rm: false, anatomicalZone: '',            ytUrl: '' },
    { id: 'tempo_run_400',     name: 'Tempo Run 400m',                   trackE1rm: false, anatomicalZone: '',            ytUrl: '' },
    { id: 'agility_5_10_5',    name: '5-10-5 Agility Drill',            trackE1rm: false, anatomicalZone: '',            ytUrl: '' },
    { id: 't_test',            name: 'T-Test Agilità',                   trackE1rm: false, anatomicalZone: '',            ytUrl: '' },
    { id: 'pro_agility',       name: 'Pro Agility Shuttle',              trackE1rm: false, anatomicalZone: '',            ytUrl: '' },
    { id: 'ladder_drill',      name: 'Ladder Drill',                     trackE1rm: false, anatomicalZone: '',            ytUrl: '' },
    { id: 'cone_drill',        name: 'Cone Drill',                       trackE1rm: false, anatomicalZone: '',            ytUrl: '' },
    { id: 'farmer_carry',      name: 'Farmer Carry',                     trackE1rm: false, anatomicalZone: 'shoulders',  ytUrl: '' },
    { id: 'yoke_carry',        name: 'Yoke Carry',                       trackE1rm: false, anatomicalZone: 'lowerback',   ytUrl: '' },
    { id: 'battle_ropes',      name: 'Battle Ropes',                     trackE1rm: false, anatomicalZone: 'shoulders',  ytUrl: '' },
    { id: 'row_machine',       name: 'Vogatore (Rowing Machine)',         trackE1rm: false, anatomicalZone: 'lowerback',   ytUrl: '' },
    { id: 'assault_bike',      name: 'Assault Bike',                     trackE1rm: false, anatomicalZone: '',            ytUrl: '' },
    { id: 'ski_erg',           name: 'Ski Erg',                          trackE1rm: false, anatomicalZone: 'shoulders',  ytUrl: '' },
    { id: 'bike_sprint',       name: 'Bike Sprint',                      trackE1rm: false, anatomicalZone: '',            ytUrl: '' },
];

// ─────────────────────────────────────────────────────────────
// STATO APPLICAZIONE
// DB è un oggetto condiviso: le mutazioni di proprietà (push,
// assegnazione di chiavi) sono visibili a tutti gli importatori.
// Non riassegnare DB stesso — usa replaceDB() per sincronizzare
// i dati caricati dal cloud/localStorage.
// ─────────────────────────────────────────────────────────────
export const DB = {
    athletes:          [],
    sessions:          [],
    schedules:         {},
    mesocycles:        [],
    injuries:          [],
    wellness:          { sleep:4, stress:2, sore:2, motiv:4, cycle:'N/A', weight:'', bf:'' },
    wellnessByAthlete: {},   // { [athleteId]: { sleep, sore, readinessScore } } — ultimo check-in per atleta
    messages:          {},   // { [athleteId]: [msg, ...] } — messaggi diretti coach ↔ atleta
    macroPlans:        {},   // { [athleteId]: { weeks, plan: [{week, phase, targetSessions, notes}] } }
    nutrition:         {},   // { [athleteId]: [{ date, kcal, proteine, carboidrati, grassi, note }] }
    nutritionTargets:  {}    // { [athleteId]: { kcal, proteine, carboidrati, grassi } }
};

export function replaceDB(data) {
    DB.athletes   = data.athletes   || [];
    DB.sessions   = data.sessions   || [];
    DB.schedules  = data.schedules  || {};
    DB.mesocycles = data.mesocycles || [];
    DB.injuries   = data.injuries   || [];
    if (data.wellness)          DB.wellness          = data.wellness;
    if (data.wellnessByAthlete) DB.wellnessByAthlete = data.wellnessByAthlete;
    if (data.messages)          DB.messages          = data.messages;
    if (data.macroPlans)        DB.macroPlans        = data.macroPlans;
    if (data.nutrition)         DB.nutrition         = data.nutrition;
    if (data.nutritionTargets)  DB.nutritionTargets  = data.nutritionTargets;
}

// Stato primitivo raccolto in un oggetto per permettere mutazioni
// visibili a tutti i moduli che importano appState.
export const appState = {
    selAthId:            '',
    curPanel:            'dashboard',
    edSessId:            '',
    pwRpe:               0,
    pwStars:             0,
    currentProgExIndex:  null,
    saveDbTimeout:       null,
    calWeekOffset:       0,
    // billing
    coachPlan:           'free',
    coachAthleteLimit:   3,
    coachSubStatus:      'inactive',
    coachPeriodEnd:      null,
    // branding / team
    brandName:           null,
    brandColor:          '#f97316',
    brandLogoUrl:        null,
    coachRole:           'head',
    headCoachId:         null,
};

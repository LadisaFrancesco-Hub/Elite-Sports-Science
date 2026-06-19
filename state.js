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

export const EXERCISE_LIBRARY = [
    { id: 'chest_press',      name: 'Chest Press',                      trackE1rm: true  },
    { id: 'shoulder_press',   name: 'Shoulder Press',                   trackE1rm: true  },
    { id: 'landmine_row',     name: 'Landmine Single Arm Row',          trackE1rm: true  },
    { id: 'db_bench_30',      name: 'DB Bench Press Panca 30',          trackE1rm: true  },
    { id: 'lat_machine',      name: 'Lat Machine',                      trackE1rm: true  },
    { id: 'cable_row_60',     name: 'Single Arm Cable Row Panca 60',    trackE1rm: true  },
    { id: 'leg_press',        name: 'Leg Press 45',                     trackE1rm: true  },
    { id: 'step_up',          name: 'Step Up Single Leg',               trackE1rm: true  },
    { id: 'bb_rdl',           name: 'BB RDL',                           trackE1rm: true  },
    { id: 'back_lunges',      name: 'Back Lunges',                      trackE1rm: true  },
    { id: 'bulgarian_lunges', name: 'Bulgarian Lunges',                 trackE1rm: true  },
    { id: 'hip_thrust',       name: 'Hip Thrust Machine',               trackE1rm: true  },
    { id: 'bench_press_bb',   name: 'Bench Press Bilanciere',           trackE1rm: true  },
    { id: 'back_squat',       name: 'Back Squat',                       trackE1rm: true  },
    { id: 'deadlift',         name: 'Stacco da Terra',                  trackE1rm: true  },
    { id: 'trap_bar',         name: 'Trap Bar Deadlift',                trackE1rm: true  },
    { id: 'pec_fly',          name: 'Pec Fly',                          trackE1rm: false },
    { id: 'push_up',          name: 'Elevated Push Up',                 trackE1rm: false },
    { id: 'curl_db_45',       name: 'Curl DB Panca 45',                 trackE1rm: false },
    { id: 'overhead_ext',     name: 'Overhead Extension Cavi Bassi',    trackE1rm: false },
    { id: 'push_down',        name: 'Push Down Cavi',                   trackE1rm: false },
    { id: 'cable_delt',       name: 'Cable Delt Raises',                trackE1rm: false },
    { id: 'face_pull',        name: 'Face Pull',                        trackE1rm: false },
    { id: 'bb_curl',          name: 'BB Curl',                          trackE1rm: false },
    { id: 'french_press',     name: 'French Press',                     trackE1rm: false },
    { id: 'hammer_curl',      name: 'Cable Hammer Curl',                trackE1rm: false },
    { id: 'leg_curl',         name: 'Leg Curl',                         trackE1rm: false },
    { id: 'leg_ext',          name: 'Leg Extension',                    trackE1rm: false },
    { id: 'crunch_cable',     name: 'Weighted Crunch with Cable',       trackE1rm: false },
    { id: 'bicycle_crunch',   name: 'Bicycle Crunch',                   trackE1rm: false },
    { id: 'hanging_leg_raise',name: 'Hanging Leg Raise',                trackE1rm: false }
];

// ─────────────────────────────────────────────────────────────
// STATO APPLICAZIONE
// DB è un oggetto condiviso: le mutazioni di proprietà (push,
// assegnazione di chiavi) sono visibili a tutti gli importatori.
// Non riassegnare DB stesso — usa replaceDB() per sincronizzare
// i dati caricati dal cloud/localStorage.
// ─────────────────────────────────────────────────────────────
export const DB = {
    athletes:   [],
    sessions:   [],
    schedules:  {},
    mesocycles: [],
    injuries:   [],
    wellness:   { sleep:4, stress:2, sore:2, motiv:4, cycle:'N/A', weight:'', bf:'' }
};

export function replaceDB(data) {
    DB.athletes   = data.athletes   || [];
    DB.sessions   = data.sessions   || [];
    DB.schedules  = data.schedules  || {};
    DB.mesocycles = data.mesocycles || [];
    DB.injuries   = data.injuries   || [];
    if (data.wellness) DB.wellness = data.wellness;
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
};

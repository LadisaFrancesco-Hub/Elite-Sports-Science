# Come il coach struttura e scrive le schede

> Guida di riferimento per Claude. **Leggi questo file prima di creare o modificare una scheda
> di allenamento** (nel DB o come bozza), così rispetti lo stile del coach senza doverlo
> ri-dedurre ogni volta.
>
> ⚠️ Questo file descrive SOLO **come** si scrive una scheda (modello dati, formato, workflow).
> NON contiene scelte di programmazione (esercizi, serie, onde, metodologia): quelle sono
> **diverse per ogni atleta** e vanno decise caso per caso col coach. Qui c'è solo il "contenitore",
> non il "contenuto".

Derivata dall'analisi delle schede reali in produzione (progetto Supabase `ncvmnoaelzdmuiqrvcjl`).

---

## 1. Modello dati — dove vivono le schede

Le schede **non** stanno nel codice: stanno nella tabella `public.schedules`.
Una **riga = una seduta** (un giorno di allenamento).

Colonne che contano:
- `athlete_id` → FK a `atleti.id`.
- `session_name` → nome seduta, MAIUSCOLO e corto (`POTENZA`, `UPPER 1`, `LOWER`, `RFD LINEARE`).
- `meso` → **tutte le sedute della stessa scheda devono avere lo STESSO `meso`** (es. `Meso 1`, `Off-Season Potenza`). Il client raggruppa per `athlete_id` + `meso`. Se trova più `meso` per un atleta ne sceglie uno solo → non spezzare una scheda su `meso` diversi.
- `duration` → n° totale di settimane del mesociclo (es. `8`).
- `phase` → fase (es. `Accumulo`, `Off-season`); è a livello scheda (valore unico).
- `coach_note`, `objective` → note/obiettivo a livello scheda (spesso vuote o una riga).
- `exercises` → **JSONB**, array di esercizi (vedi §3–4). È il cuore.
- `scheduled_days` → `int[]` con gli indici giorno **JS `getDay()`**: `0`=Dom, `1`=Lun, `2`=Mar, `3`=Mer, `4`=Gio, `5`=Ven, `6`=Sab. Es. 4 giorni Lun/Mar/Gio/Ven = `{1,2,4,5}`.
- `session_type` → `Palestra` / `Casa` / `Corsa`… (default `Palestra`).
- **Blocchi (fasi del meso)**: `block_id`, `block_name`, `block_week_start`, `block_week_end`. Il client sotto-raggruppa le sedute per `block_id` ricostruendo i blocchi. `meso_start_date` (date) è ripetuta su ogni riga e serve a calcolare la settimana corrente.

### Regole di mappatura (verificate nel codice)
- **Settimana corrente** = `floor((oggi − meso_start_date)/7) + 1`, limitata a `duration`. Prima della data d'inizio → settimana 1.
- **Progressioni per settimana** usano le **settimane ASSOLUTE del meso** (`w1`, `w2`, … `wN`), non relative al blocco. Es. un blocco che copre le settimane 3–8 usa `w3..w8`.
- **Blocco attivo** in una settimana = quello con `week_start ≤ w ≤ week_end`. Oltre l'ultimo blocco, resta sull'ultimo. (Il filtro per blocco scatta solo con ≥2 blocchi.)
- **Giorno → seduta**: per **ORDINE**. Il client fa `idx = scheduled_days.indexOf(giorno)` e prende `sessions[idx]` tra le sedute del blocco attivo. Quindi **l'ordine delle sedute dentro il blocco deve seguire l'ordine dei giorni**. Con `{1,2,4,5}`: 1ª seduta → Lun, 2ª → Mar, 3ª → Gio, 4ª → Ven. (L'ordine di ritorno segue l'ordine d'inserimento delle righe: inserisci nell'ordine desiderato.)

---

## 2. Stile di scrittura degli esercizi (il "tono" del coach)

- **Nome esercizio in INGLESE**, minuscolo, in alto. Es: `back squat`, `hip thrust`, `nordic hamstring`, `bulgarian split squat`, `spanish squat`, `seated leg curl`, `leg press 45`, `pallof press`, `face pull`, `walking lunges`, `trap bar deadlift`. (Mobilità/skill possono restare miste IT/EN: `t-spine rot`, `circ anche`.)
- **`note` = lo stretto necessario**, sotto il nome: attrezzo, variante, tempo, o specifica tecnica. Niente spiegazioni lunghe. Esempi reali:
  - attrezzo: `db`, `con kb`, `ai cavi`, `con macchina`, `elastico arancione`, `con elastico`
  - variante/assetto: `inclinata` (gradi panca), `sumo`, `con extra rot torso`, `1 BW`
  - tempo/metodo: `5"ECC`, `solo ECC`, `no elastico- 5"ECC`, `3'' ecc`
  - cue sintetico: `caviglia rigida`, `stick landing`, `max velocita`, `da fermo`
- Il coach **non ripete** nelle note ciò che è già chiaro dal nome. Se non serve, la nota è `""`.

---

## 3. Struttura di una seduta (come si ordina il JSON)

Ordine tipico dentro `exercises`:
1. **Warm-up** → esercizi con `"section":"warmup"`, quasi sempre raggruppati in **superset** (stesso `groupId`): mobilità / attivazione / primer (es. `ankle rocker`, `90/90 hip switch`, `t-spine rot`, `pogo jumps`, `extra rot delt`, `face pull`). `rir:"—"`.
2. **Parte centrale** → fondamentali e accessori. I fondamentali hanno `"trackE1rm":true` e spesso un oggetto `progression` (onda settimanale). Il resto `trackE1rm:false`.
3. **Superset** nella parte centrale = esercizi consecutivi con lo stesso `groupId`.
4. **Circuit** (lavoro atletico/condizionale) = un oggetto `"type":"circuit"` con `circuitMeta` + `circuitExercises` (vedi §4).

---

## 4. Schema del campo `exercises` (chiavi e convenzioni)

Chiavi standard di un oggetto esercizio:

| campo | tipo | note |
|---|---|---|
| `name` | string | nome EN, minuscolo |
| `note` | string | stretto necessario; `""` se nulla |
| `set` | int | n° serie |
| `rep` | string | `"8"`, range `"8-10"`, per lato `"6 ea"` / `"6 el"`, tempo `"45''"` / `"30''"`, distanza `"10m"` / `"12-15m"` |
| `rir` | string | numero (`"2"`,`"1"`,`"0"`) o `"—"` per mobilità/plio/warmup |
| `kg` | int/string | `0` se autoregolato o a corpo libero; numero se carico fisso; può ospitare il tempo di un iso (`"45''"`) o note tipo `"el + leggero"` |
| `rest` | string | secondi con apici: `"120''"`, `"90''"`, `"0''"` (dentro superset) |
| `tut` | string | di solito `"-"` |
| `arm` | string | di solito `"Bi"` (bilaterale) |
| `type` | string | `"normal"` \| `"superset"` \| `"circuit"` |
| `groupId` | string | presente se `type:"superset"`; condiviso dagli esercizi del gruppo |
| `section` | string | `"warmup"` per il riscaldamento; assente/omesso per la parte centrale |
| `trackE1rm` | bool | `true` sui fondamentali tracciati (squat, panca, stacco, hip thrust, leg press…) |
| `wset` | int | serie di avvicinamento/ramp (0 se nessuna) |
| `ytUrl` | string | `""` di default |
| `anatomicalZone` | string | `""` di default |
| `progression` | object | opzionale, onda settimanale → vedi sotto |

**`progression`** (onda per settimana assoluta del meso):
```json
"progression": {
  "w1": {"set": 4, "rep": "5", "kg": 105, "rir": "2"},
  "w2": {"set": 4, "rep": "4", "kg": 110.5, "rir": "2"}
}
```
Chiavi `w{N}` con N = settimana assoluta del meso. Ogni voce almeno `set`/`rep`/`kg`; opzionali `rir`, `tut`, `tech`. Se il carico è autoregolato, lascia `kg:0` e fai ondeggiare `set`/`rep`/`rir`.

**`circuit`** (atletico/condizionale):
```json
{
  "type":"circuit","name":"Circuito a Tempo","section":"centrale",
  "set":0,"rep":0,"rest":"0","kg":0,
  "circuitMeta":{"rounds":4,"workTime":20,"restBetweenEx":20,"restBetweenRounds":120},
  "circuitExercises":[{"name":"medball chest push","note":""},{"name":"navetta 4+4+scatto","note":""}]
}
```

### Template minimo pronto all'uso (solo formato — i valori sono esempi)
```json
// warm-up (superset)
{"kg":0,"arm":"Bi","rep":"6 ea","rir":"—","set":2,"tut":"-","name":"ankle rocker","note":"ginocchio oltre punta","rest":"0''","type":"superset","wset":0,"ytUrl":"","groupId":"wu1","section":"warmup","trackE1rm":false,"anatomicalZone":""}
// fondamentale con onda
{"kg":0,"arm":"Bi","rep":"5","rir":"2","set":4,"tut":"-","name":"back squat","note":"","rest":"180''","type":"normal","wset":2,"ytUrl":"","trackE1rm":true,"anatomicalZone":"","progression":{"w1":{"set":4,"rep":"5","kg":0,"rir":"2"},"w2":{"set":4,"rep":"4","kg":0,"rir":"1"}}}
// accessorio normale
{"kg":0,"arm":"Bi","rep":"10","rir":"1","set":3,"tut":"-","name":"seated leg curl","note":"","rest":"60''","type":"normal","wset":0,"ytUrl":"","trackE1rm":false,"anatomicalZone":""}
```

---

## 5. Workflow per inserire/aggiornare una scheda nel DB

1. Trova l'`atleti.id` (es. `select id,name from atleti`).
2. Decidi **meso unico**, `duration` (settimane totali), giorni (`scheduled_days`, indici JS), `meso_start_date`.
3. Definisci i blocchi: `block_id`/`block_name`/`block_week_start`/`block_week_end` (settimane assolute).
4. **Ordina le sedute** dentro ogni blocco secondo l'ordine dei giorni (`scheduled_days`).
5. Scrivi gli `exercises` nello stile sopra (gli esercizi/serie/onde li decidi col coach, per quell'atleta). Sui fondamentali tracciati aggiungi `trackE1rm:true` + eventuale `progression`.
6. INSERT/UPDATE via SQL. **Usa dollar-quoting** per il JSONB (`exercises = $EX$[ ... ]$EX$::jsonb`) così gli apici `''` nei `rest`/tempi non vanno escapati.
7. Rimuovi eventuali sedute-placeholder vuote create alla creazione dell'atleta.
8. **Verifica**: `jsonb_array_length`, conteggio warmup/`trackE1rm`/`progression`, e `string_agg` dei nomi per controllare l'ordine della parte centrale.

> Nota: inserire via SQL è il pattern già usato. Nessun deploy client necessario: la app ricarica le schede dal DB.

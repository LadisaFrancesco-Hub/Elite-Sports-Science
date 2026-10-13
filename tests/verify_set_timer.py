"""Verifica la feature "serie a tempo → timer vero" a viewport iPhone 390x844.

Estrae il VERO sorgente di `_setTimeSeconds` e `startSetTimer` da workout.js
(stesso pattern del test tecniche), li inietta in pagina con stub per le
dipendenze di modulo, usa il VERO styles.css e asserisce:
  - CSS: un pallino `.dot.timed` ha bordo accento; `.running` mostra l'anello
  - detection: _setTimeSeconds('45"')=45, ('1\\'30"')=90, ('10')=0, compound=0
  - runtime: tap su pallino timed (secs=1) → classe .running + countdown visibile
    → a 0 suona (playTimerEndSound chiamato) + .done + etichetta ripristinata
  - tap durante il countdown → annulla e ripristina l'etichetta
Avvia un http.server interno sulla root del repo.
"""
import os, re, threading, functools, http.server, socketserver
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = 8104
RESULTS = []

def check(name, ok, detail=""):
    RESULTS.append(bool(ok))
    print(("PASS" if ok else "FAIL"), "-", name, ("· " + detail) if detail else "")

src = open(os.path.join(ROOT, "workout.js")).read()

def extract(name):
    m = re.search(r"(?:export\s+)?function " + name + r"\b", src)
    assert m, "funzione non trovata: " + name
    i = src.index("{", m.start())
    depth = 0
    for j in range(i, len(src)):
        if src[j] == "{": depth += 1
        elif src[j] == "}":
            depth -= 1
            if depth == 0:
                body = src[m.start():j+1]
                return body.replace("export function", "function", 1)
    raise RuntimeError("brace mismatch " + name)

REAL = extract("_setTimeSeconds") + "\n" + extract("startSetTimer") + "\n" + \
       "window._setTimeSeconds=_setTimeSeconds; window.startSetTimer=startSetTimer;"

FIXTURE = """<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="stylesheet" href="/styles.css"></head>
<body class="is-athlete" style="margin:0;padding:12px;">
<div id="dots" style="display:flex;flex-wrap:wrap;gap:10px;">
  <div class="dot timed" id="ld-0-0" data-label='45&quot;' data-secs="1">45&quot;</div>
  <div class="dot timed" id="ld-0-1" data-label='45&quot;' data-secs="1">45&quot;</div>
</div>
<script>
  // Stub delle dipendenze di modulo usate da startSetTimer
  window.__beeps = 0;
  function unlockAudio(){}
  function playTimerEndSound(){ window.__beeps++; }
  function _autoStartRestTimer(){}
  function updateLiveTotals(){}
  function formatTime(s){var m=Math.floor(s/60),x=s%60;return m+':' + (x<10?'0':'') + x;}
  function toggleDot(){}
  window.getEdExercises=function(){return [];};
</script>
<script>__REAL__</script>
</body></html>"""

def serve():
    os.chdir(ROOT)
    path = os.path.join(ROOT, "tests", "_timer_fixture.html")
    with open(path, "w") as f:
        f.write(FIXTURE.replace("__REAL__", REAL))
    httpd = socketserver.TCPServer(("127.0.0.1", PORT),
            functools.partial(http.server.SimpleHTTPRequestHandler))
    httpd.allow_reuse_address = True
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd

httpd = serve()
try:
    with sync_playwright() as p:
        b = p.chromium.launch()
        pg = b.new_page(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True)
        errs = []
        pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.goto(f"http://127.0.0.1:{PORT}/tests/_timer_fixture.html")
        pg.wait_for_selector("#dots .dot.timed")

        # 1) detection sul vero _setTimeSeconds
        d = pg.evaluate("""() => ({
            a: _setTimeSeconds('45\\"'), b: _setTimeSeconds("1'30\\""),
            c: _setTimeSeconds('10'), d: _setTimeSeconds("30''/lato + 12/lato"),
            e: _setTimeSeconds('2\\'') })""")
        check("detection 45\"=45", d["a"] == 45, str(d["a"]))
        check("detection 1'30\"=90", d["b"] == 90, str(d["b"]))
        check("detection reps 10=0", d["c"] == 0, str(d["c"]))
        check("detection compound=0", d["d"] == 0, str(d["d"]))
        check("detection 2'=120", d["e"] == 120, str(d["e"]))

        # 2) CSS: bordo accento sul pallino timed (idle)
        bc = pg.eval_on_selector("#ld-0-0", "el => getComputedStyle(el).borderTopColor")
        check("timed ha bordo accento (non grigio default)", bc not in ("", "rgb(0, 0, 0)") and "rgba(0, 0, 0, 0)" not in bc, bc)

        # 3) dot entro 44px (no overflow a 390)
        w = pg.eval_on_selector("#ld-0-0", "el => Math.round(el.getBoundingClientRect().width)")
        check("pallino = 44px", w == 44, str(w))

        # 4) runtime: avvio countdown
        pg.evaluate("startSetTimer(document.getElementById('ld-0-0'))")
        running = pg.eval_on_selector("#ld-0-0", "el => el.classList.contains('running')")
        ring = pg.eval_on_selector("#ld-0-0", "el => getComputedStyle(el).boxShadow")
        txt0 = pg.eval_on_selector("#ld-0-0", "el => el.textContent")
        check("durante il countdown ha .running", running)
        check(".running mostra anello (box-shadow)", ring and ring != "none", ring[:40])
        check("countdown mostra un numero (<=secs)", txt0.strip().isdigit() and int(txt0) <= 1, txt0)

        # attende la fine del timer (secs=1)
        pg.wait_for_timeout(1500)
        done   = pg.eval_on_selector("#ld-0-0", "el => el.classList.contains('done')")
        norun  = pg.eval_on_selector("#ld-0-0", "el => !el.classList.contains('running')")
        label  = pg.eval_on_selector("#ld-0-0", "el => el.textContent")
        beeps  = pg.evaluate("() => window.__beeps")
        check("a fine timer: .done", done)
        check("a fine timer: niente .running", norun)
        check("a fine timer: etichetta ripristinata (45\")", label.strip() == '45"', repr(label))
        check("a fine timer: suono emesso (playTimerEndSound)", beeps >= 1, str(beeps))

        # 5) annullo: avvio e poi secondo tap ferma e ripristina
        pg.evaluate("startSetTimer(document.getElementById('ld-0-1'))")
        pg.wait_for_timeout(200)
        pg.evaluate("startSetTimer(document.getElementById('ld-0-1'))")  # secondo tap = annulla
        lab2  = pg.eval_on_selector("#ld-0-1", "el => el.textContent")
        run2  = pg.eval_on_selector("#ld-0-1", "el => el.classList.contains('running')")
        done2 = pg.eval_on_selector("#ld-0-1", "el => el.classList.contains('done')")
        check("annulla: etichetta ripristinata", lab2.strip() == '45"', repr(lab2))
        check("annulla: niente .running", not run2)
        check("annulla: non completato", not done2)

        pg.screenshot(path=os.path.join(ROOT, "tests", "set_timer_iphone.png"))
        check("0 errori console", len(errs) == 0, "; ".join(errs[:3]))
        b.close()
finally:
    httpd.shutdown()

ok = sum(RESULTS)
print(f"\n{ok}/{len(RESULTS)} PASS")
import sys as _s; _s.exit(0 if ok == len(RESULTS) else 1)

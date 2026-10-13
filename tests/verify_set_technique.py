"""Verifica render/CSS della feature "tecnica d'intensità per-serie" a viewport iPhone 390x844.

Usa il VERO styles.css del progetto. Inietta il markup che workout.js produce
(pallini set, uno con classe `dot tech` + data-tech) e asserisce:
  - la serie bersaglio ha anello accento (box-shadow != none) e mini-badge ::after = "DROP"
  - solo la serie bersaglio ha classe .tech
  - la riga meta con reps compattate ("1×16+4+4+4") NON sfora a 390px
Avvia un http.server interno sulla root del repo.
"""
import os, sys, threading, functools, http.server, socketserver
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = 8102
RESULTS = []

def check(name, ok, detail=""):
    RESULTS.append(ok)
    print(("PASS" if ok else "FAIL"), "-", name, ("· " + detail) if detail else "")

# Fixture servita dalla root (così /styles.css risolve). Scope body.is-athlete.
FIXTURE = """<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="stylesheet" href="/styles.css"></head>
<body class="is-athlete" style="margin:0;padding:12px;">
<div class="ax-ex">
  <p class="ax-ex-meta" id="meta-main">[Bi] 3×8 <span class="ax-sep">•</span> <b>80kg</b> · RIR 2</p>
  <div id="dots" style="display:flex;flex-wrap:wrap;gap:10px;margin-top:8px;width:100%;">
    <div class="dot" id="ld-0-0">1</div>
    <div class="dot" id="ld-0-1">2</div>
    <div class="dot tech" id="ld-0-2" data-tech="DROP">3</div>
  </div>
</div>
<div class="ax-ex" style="margin-top:12px;">
  <p class="ax-ex-meta" id="meta-legacy">1×16+4+4+4 <span class="ax-sep">•</span> <b>60kg</b></p>
</div>
</body></html>"""

def serve():
    os.chdir(ROOT)
    with open(os.path.join(ROOT, "tests", "_tech_fixture.html"), "w") as f:
        f.write(FIXTURE)
    handler = functools.partial(http.server.SimpleHTTPRequestHandler)
    httpd = socketserver.TCPServer(("127.0.0.1", PORT), handler)
    httpd.allow_reuse_address = True
    t = threading.Thread(target=httpd.serve_forever, daemon=True)
    t.start()
    return httpd

httpd = serve()
try:
    with sync_playwright() as p:
        b = p.chromium.launch()
        pg = b.new_page(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True)
        errs = []
        pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
        pg.goto(f"http://127.0.0.1:{PORT}/tests/_tech_fixture.html")
        pg.wait_for_selector("#dots .dot")

        # viewport 390
        check("viewport 390px", pg.viewport_size["width"] == 390, str(pg.viewport_size))

        # solo il 3° pallino ha .tech
        n_tech = pg.eval_on_selector_all(".dot.tech", "els => els.length")
        third_is_tech = pg.eval_on_selector("#ld-0-2", "el => el.classList.contains('tech')")
        first_plain = pg.eval_on_selector("#ld-0-0", "el => !el.classList.contains('tech')")
        check("solo la serie bersaglio ha .tech", n_tech == 1 and third_is_tech and first_plain,
              f"n_tech={n_tech}")

        # anello accento (box-shadow risolto, non 'none')
        shadow = pg.eval_on_selector("#ld-0-2",
            "el => getComputedStyle(el).boxShadow")
        check("serie bersaglio: anello accento presente", shadow and shadow != "none", shadow[:60])

        # mini-badge ::after con il codice tecnica
        after = pg.eval_on_selector("#ld-0-2",
            "el => getComputedStyle(el, '::after').content")
        check("mini-badge ::after = DROP", "DROP" in (after or ""), repr(after))

        # la riga meta legacy compattata NON sfora
        overflow = pg.eval_on_selector("#meta-legacy",
            "el => ({sw: el.scrollWidth, cw: el.clientWidth})")
        check("riga meta '16+4+4+4' non sfora a 390px",
              overflow["sw"] <= overflow["cw"] + 1, str(overflow))

        # anche la meta principale non sfora
        ov2 = pg.eval_on_selector("#meta-main",
            "el => ({sw: el.scrollWidth, cw: el.clientWidth})")
        check("riga meta principale non sfora", ov2["sw"] <= ov2["cw"] + 1, str(ov2))

        pg.screenshot(path=os.path.join(ROOT, "tests", "set_technique_iphone.png"))
        check("0 errori console", len(errs) == 0, "; ".join(errs))
        b.close()
finally:
    httpd.shutdown()
    try: os.remove(os.path.join(ROOT, "tests", "_tech_fixture.html"))
    except OSError: pass

ok = all(RESULTS)
print(f"\n{'✅ TUTTI PASS' if ok else '❌ FALLITI'}: {sum(RESULTS)}/{len(RESULTS)}")
sys.exit(0 if ok else 1)

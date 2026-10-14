#!/usr/bin/env python3
"""Verifica le 'day pills' (giorni allenamento del blocco) nell'editor schede.
Render dello snippet reale (preso da index.html) + vero styles.css, poi check
layout (7 in una riga, anche a 390px), stato :checked arancione, input nascosto.
Riutilizzabile. Uso: python3 tests/verify_day_pills.py"""
import re, sys, pathlib
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
CSS = (ROOT / "styles.css").read_text()
HTML_SRC = (ROOT / "index.html").read_text()

# Estrae il blocco #ed-scheduled-days reale da index.html
m = re.search(r'(<div id="ed-scheduled-days".*?</div>)', HTML_SRC, re.S)
assert m, "blocco #ed-scheduled-days non trovato in index.html"
pills = m.group(1)

PAGE = f"""<!doctype html><html><head><meta charset="utf-8">
<style>{CSS}</style></head>
<body style="background:#0A0C0F;padding:20px">
<div style="max-width:620px">{pills}</div>
</body></html>"""

def run(width, label, check_single_row):
    results = []
    with sync_playwright() as p:
        b = p.chromium.launch()
        ctx = b.new_context(viewport={"width": width, "height": 900},
                            is_mobile=(width < 500), has_touch=(width < 500),
                            device_scale_factor=2)
        pg = ctx.new_page()
        errs = []
        pg.on("console", lambda msg: errs.append(msg.text) if msg.type == "error" else None)
        pg.set_content(PAGE)

        # spunta Mer(3) e Ven(5) via proprietà JS (come fa renderEditor in app.js)
        pg.eval_on_selector_all('#ed-scheduled-days input[type="checkbox"]',
            "els=>els.forEach(e=>{if(e.value==='3'||e.value==='5')e.checked=true})")
        pg.wait_for_timeout(300)  # lascia completare la transizione .15s dello span

        data = pg.evaluate("""() => {
          const cont = document.getElementById('ed-scheduled-days');
          const pills = [...cont.querySelectorAll('.ed-day')];
          const tops = new Set(pills.map(p => Math.round(p.getBoundingClientRect().top)));
          const spanOf = lab => lab.querySelector('span');
          const checkedLab = pills.find(p => p.querySelector('input').checked);
          const uncheckedLab = pills.find(p => !p.querySelector('input').checked);
          const inp = cont.querySelector('input[type=checkbox]');
          const r = inp.getBoundingClientRect();
          const cs = getComputedStyle(cont);
          return {
            nPills: pills.length,
            rows: tops.size,
            contWidth: Math.round(cont.getBoundingClientRect().width),
            pillW: Math.round(pills[0].getBoundingClientRect().width),
            display: cs.display,
            cols: cs.gridTemplateColumns.split(' ').length,
            checkedBg: getComputedStyle(spanOf(checkedLab)).backgroundColor,
            checkedColor: getComputedStyle(spanOf(checkedLab)).color,
            uncheckedBg: getComputedStyle(spanOf(uncheckedLab)).backgroundColor,
            inputW: Math.round(r.width),
            inputOpacity: getComputedStyle(inp).opacity,
          };
        }""")
        b.close()

    def ok(name, cond, extra=""):
        results.append(cond)
        print(f"  [{'PASS' if cond else 'FAIL'}] {name}{(' — '+extra) if extra else ''}")

    print(f"\n== {label} ({width}px) ==")
    ok("7 pill presenti", data["nPills"] == 7, str(data["nPills"]))
    ok("display grid", data["display"] == "grid", data["display"])
    ok("7 colonne grid", data["cols"] == 7, str(data["cols"]))
    if check_single_row:
        ok("tutte su UNA riga", data["rows"] == 1, f'{data["rows"]} righe')
    ok("pill arancione su :checked (= --teal)",
       "0.76 0.16 52" in data["checkedBg"] and data["checkedBg"] != data["uncheckedBg"],
       str(data["checkedBg"]))
    ok("testo scuro su pill attiva",
       data["checkedColor"] in ("rgb(10, 12, 15)",), str(data["checkedColor"]))
    ok("pill non attiva = superficie --s1",
       data["uncheckedBg"] == "rgb(16, 19, 24)", str(data["uncheckedBg"]))
    ok("checkbox nativo nascosto",
       data["inputOpacity"] == "0" and data["inputW"] <= 1,
       f'w={data["inputW"]} op={data["inputOpacity"]}')
    return all(results)

allok = True
allok &= run(1200, "Desktop editor", True)
allok &= run(390, "iPhone", True)  # deve restare 1 riga anche su mobile
print("\n" + ("ALL PASS ✅" if allok else "SOME FAILED ❌"))
sys.exit(0 if allok else 1)

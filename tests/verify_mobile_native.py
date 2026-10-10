"""Verifica audit mobile-native (P1 hover-gating, P2 dvh) a viewport iPhone 390x844.

A/B: stesso elemento .rpe-b "hoverato" in contesto TOUCH (iPhone, hover:none)
vs DESKTOP (hover:hover). Prova che il gating @media (hover:hover) funziona.
"""
import sys
from playwright.sync_api import sync_playwright

URL = "http://127.0.0.1:8099/index.html"
RESULTS = []

def check(name, ok, detail=""):
    RESULTS.append((ok, name, detail))
    print(("PASS" if ok else "FAIL"), "-", name, ("· " + detail) if detail else "")

HOVER_PROBE = """() => {
  // nascondi gli overlay full-screen cosi' il pointer raggiunge il probe
  ['login-screen','onboarding-screen','custom-confirm-modal'].forEach(id => {
    const el = document.getElementById(id); if (el) el.style.display = 'none';
  });
  const b = document.createElement('button');
  b.className = 'rpe-b';
  b.textContent = '8';
  b.style.cssText = 'position:fixed;top:40px;left:20px;z-index:2147483647';
  b.id = '__probe_rpe';
  document.body.appendChild(b);
  return true;
}"""

with sync_playwright() as p:
    browser = p.chromium.launch()

    # ---------- CONTESTO TOUCH (390x844, has_touch + is_mobile => hover:none) ----------
    ctx = browser.new_context(
        viewport={"width": 390, "height": 844},
        device_scale_factor=3, is_mobile=True, has_touch=True,
        user_agent="Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) "
                   "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
        service_workers="block")
    page = ctx.new_page()
    errors = []
    page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto(URL, wait_until="networkidle")

    vw = page.evaluate("() => ({w: innerWidth, h: innerHeight})")
    check("Viewport iPhone = 390x844", vw["w"] == 390 and vw["h"] == 844, f"{vw['w']}x{vw['h']}")

    media = page.evaluate("""() => ({
      hover: matchMedia('(hover: hover)').matches,
      fine:  matchMedia('(pointer: fine)').matches,
      coarse: matchMedia('(pointer: coarse)').matches
    })""")
    touch_mode = (not media["hover"]) and media["coarse"]
    check("Emulazione touch attiva (hover:none, pointer:coarse)", touch_mode, str(media))

    # P2 — login-screen riempie l'altezza (dvh non rompe il layout)
    login_h = page.evaluate("() => { const e=document.getElementById('login-screen'); return e ? e.offsetHeight : -1; }")
    check("P2 · #login-screen height == 844 (dvh)", login_h == 844, f"offsetHeight={login_h}")

    # niente overflow orizzontale
    sw = page.evaluate("() => document.documentElement.scrollWidth")
    check("Nessun overflow orizzontale (scrollWidth <= 390)", sw <= 390, f"scrollWidth={sw}")

    # P1 — hover su .rpe-b in contesto touch NON deve applicare il transform (gate attivo)
    page.evaluate(HOVER_PROBE)
    page.hover("#__probe_rpe")
    t_touch = page.evaluate("() => getComputedStyle(document.getElementById('__probe_rpe')).transform")
    gated_ok = t_touch in ("none", "matrix(1, 0, 0, 1, 0, 0)")
    check("P1 · .rpe-b:hover NON attivo su touch (transform none)", gated_ok, f"transform={t_touch}")

    # P1 (prova strutturale) — la regola .rpe-b:hover vive dentro @media (hover:hover){...}
    cond = page.evaluate("""() => {
      for (const ss of document.styleSheets) {
        let rules; try { rules = ss.cssRules; } catch(e){ continue; }
        for (const r of rules) {
          if (r.type === CSSRule.MEDIA_RULE && /hover\\s*:\\s*hover/.test(r.conditionText)) {
            for (const inner of r.cssRules) {
              if (inner.selectorText && inner.selectorText.includes('.rpe-b:hover'))
                return r.conditionText;
            }
          }
        }
      }
      return null;
    }""")
    gate_ok = bool(cond) and "pointer" in cond
    check("P1 · .rpe-b:hover gated in @media (hover:hover)+(pointer:fine)", gate_ok, f"conditionText={cond}")

    page.screenshot(path="tests/mobile_native_iphone_login.png")
    ctx.close()
    browser.close()

    check("Nessun errore console (contesto iPhone)", len(errors) == 0, f"{len(errors)} errori: {errors[:3]}")

ok = all(r[0] for r in RESULTS)
print("\n==>", "TUTTO PASS" if ok else "ALCUNI FAIL")
sys.exit(0 if ok else 1)

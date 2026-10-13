"""Verifica fix modale video atleta a viewport iPhone 390x844.

Bug: lo sheet del video si apriva "a metà" perche' la .bottom-bar (z-index 99999)
copriva la parte bassa del player (.mo z-index 200).

Check:
 1) #mo-video computed z-index > .bottom-bar z-index -> il player sta SOPRA la nav.
 2) il drag-handle (::before) e' nascosto sul modale video.
 3) il .mo-box video non ha padding laterale (video edge-to-edge).
 4) con video aperto + nav visibile, l'iframe NON e' coperto dalla nav
    (elementFromPoint sul centro-basso del video ricade dentro #mo-video).
 5) zero errori console.
"""
import sys
from playwright.sync_api import sync_playwright

URL = "http://127.0.0.1:8099/index.html"
RESULTS = []

def check(name, ok, detail=""):
    RESULTS.append((ok, name, detail))
    print(("PASS" if ok else "FAIL"), "-", name, ("· " + detail) if detail else "")

SETUP = """() => {
  // nascondi gli overlay full-screen (login/onboarding) per liberare la UI atleta
  ['login-screen','onboarding-screen','custom-confirm-modal'].forEach(id => {
    const el = document.getElementById(id); if (el) el.style.display='none';
  });
  document.body.classList.add('is-athlete');
  // mostra la bottom-bar (nav atleta) come in sessione live
  const bb = document.querySelector('.bottom-bar'); if (bb) bb.classList.add('show');
  // apri il modale video con un embed finto
  const mo = document.getElementById('mo-video');
  const ifr = document.getElementById('mo-video-iframe');
  if (ifr) ifr.src = 'about:blank';
  mo.classList.add('show');
  return true;
}"""

with sync_playwright() as p:
    browser = p.chromium.launch()
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
    page.evaluate(SETUP)
    page.wait_for_timeout(500)  # lascia finire l'animazione slide-up

    z = page.evaluate("""() => {
      const zi = el => parseInt(getComputedStyle(el).zIndex) || 0;
      const mo = document.getElementById('mo-video');
      const bb = document.querySelector('.bottom-bar');
      return { video: zi(mo), nav: bb ? zi(bb) : -1 };
    }""")
    check("1 · #mo-video z-index > bottom-bar", z["video"] > z["nav"], f"video={z['video']} nav={z['nav']}")

    handle = page.evaluate("""() => {
      const box = document.querySelector('#mo-video .mo-box');
      return getComputedStyle(box, '::before').display;
    }""")
    check("2 · drag-handle nascosto (::before display:none)", handle == "none", f"display={handle}")

    pad = page.evaluate("""() => {
      const box = document.querySelector('#mo-video .mo-box');
      const s = getComputedStyle(box);
      return { l: s.paddingLeft, r: s.paddingRight };
    }""")
    check("3 · video edge-to-edge (no padding laterale)", pad["l"] == "0px" and pad["r"] == "0px", str(pad))

    covered = page.evaluate("""() => {
      const ifr = document.getElementById('mo-video-iframe');
      const r = ifr.getBoundingClientRect();
      // punto vicino al bordo basso del video (dove prima lo copriva la nav)
      const x = r.left + r.width/2;
      const y = r.bottom - 6;
      const el = document.elementFromPoint(x, y);
      const inVideo = !!(el && el.closest('#mo-video'));
      return { inVideo, hit: el ? (el.id || el.className || el.tagName) : null,
               bottom: Math.round(r.bottom), navTop: Math.round(844 - (document.querySelector('.bottom-bar').getBoundingClientRect().height)) };
    }""")
    check("4 · bordo basso video NON coperto dalla nav", covered["inVideo"],
          f"hit={covered['hit']} videoBottom={covered['bottom']}")

    check("5 · zero errori console", len(errors) == 0, "; ".join(errors[:3]))

    page.screenshot(path="tests/video_modal_iphone.png")
    browser.close()

fails = [r for r in RESULTS if not r[0]]
print(f"\n{'='*48}\n{len(RESULTS)-len(fails)}/{len(RESULTS)} PASS")
sys.exit(1 if fails else 0)

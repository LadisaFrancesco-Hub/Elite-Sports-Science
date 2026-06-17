---
name: feedback-splash-fix
description: Splash screen senza pointer-events:none blocca interfaccia Android; fix tramite try-finally e pointer-events immediato
metadata:
  type: feedback
---

Non usare `visibility: hidden` con CSS transition per rimuovere lo splash screen: su Android, la transizione mantiene `pointer-events` attivi per tutta la durata, congelando l'interfaccia.

**Why:** Lo splash a z-index:99999 con opacity:0 ma senza pointer-events:none intercetta tutti i tocchi. Se una funzione nel DOMContentLoaded (go→loadLive→renderE1rmChart) lancia eccezione, il codice di rimozione non gira mai → app congelata per sempre.

**How to apply:** 
- Sempre usare `splash.style.pointerEvents = 'none'` PRIMA di settare opacity:0
- Usare `display:none` (non visibility:hidden) dopo il timeout
- Avvolgere TUTTO il corpo del DOMContentLoaded bootstrap in try-finally: il finally garantisce la rimozione dello splash anche in caso di eccezione in loadLive/renderE1rmChart
- In CSS: nessuna transizione su visibility per lo splash, solo opacity

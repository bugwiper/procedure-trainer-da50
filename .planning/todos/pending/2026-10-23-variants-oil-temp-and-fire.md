---
created: 2026-10-23
title: Variants for ENG OIL TEMP and ENGINE FIRE
area: scenarios
source: planning of phase 3.1 (decision V-15)
---

Phase 3.1 ships the variant mechanism and the four ALTN 1 FAIL causes only. The other two scenarios were looked at and are not cheap enough to include:

- **ENG OIL TEMP:** the causes worth drawing (degraded cooling, a power setting that is too high, low oil pressure together with high temperature) differ mostly in the oil pressure at the start, which is a quantity. A variant today carries controls and parameters only; the oil pressure branch of the checklist is decided on the start quantities, so this needs variants that overlay start quantities (and the lint guard against start branches reading them) and the oil pressure behaviour of Phase 5.
- **ENGINE FIRE:** fire in flight, fire on the ground and fire during start are different printed checklists, i.e. different scenarios, not variants of one. A variant of the same checklist (fire that goes out after the fuel is cut vs. one that keeps burning) needs a fire model beyond the single `engine_fire` parameter.

Revisit after Phase 5 (oil pressure, engine page) and when the instructor names the causes he wants drilled. The authoring guide of Phase 7 describes the variant format as shipped.

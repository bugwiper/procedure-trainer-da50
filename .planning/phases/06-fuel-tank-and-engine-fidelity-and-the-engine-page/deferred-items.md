# Deferred items, phase 6

- **e2e/scenario.spec.ts:591** (`@hooks the MFD oil gauges read the base values in the free panel and the live values in a run`) fails on desktop-, phone- and tablet-chromium since plan 06-02b: it expects a unit (`/\d+ °C/` at line 618 and 620, `BAR`) on the engine page, which 06-02b removed from every bar number. The test needs the engine-page assertions changed to the bare number (the map strip assertions before it still hold). Found while running the scenario specs of plan 06-03; out of its scope, so not fixed there.

Resolved: the engine-page assertions of that test now read bare numbers (commit 7d1159c, `fix(panel): engine page oil gauge e2e reads bare numbers`); it passes again on all chromium projects (checked in plan 06-04).

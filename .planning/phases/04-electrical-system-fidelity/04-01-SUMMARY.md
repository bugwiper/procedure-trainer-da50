---
phase: 04-electrical-system-fidelity
plan: 01
subsystem: aircraft-data
tags: [electrical, physics, cas, alternator, bus-model]
requires:
  - phase: 03-scenarios-and-engine
    provides: physics, trips, CAS rule engine, variants, 23 golden recordings
provides:
  - electricalState: one pure bus model (buses, tie relay, consumers, currents, Volts, battery rate)
  - alternator control unit faults as hidden quantities; ALTN 1 FAIL and ALTN 2 FAIL as band rules
  - alt2_output, alt2_short parameters and the alt2_breaker trip
  - EMERG FUEL PUMP powered by the main bus
affects: [04-02 ALTN 2 FAIL scenario, 04-03 docs and pointer]
status: complete
actuals:
  tokens: 11834
  tasks: 3
  commits: 4
plan_head_before: 4dd66c7b84e408c9b11bb58cfbe240d241b480e6
plan_head_after: c3c1255f838725a64cdde46953ab4076a93ca7df
tech-stack:
  added: []
  patterns: [one derived-state function read by every model, fault flag as hidden quantity read by band rule]
key-files:
  created: [src/aircraft/da50rg/electrical.ts, tests/electrical.test.ts]
  modified: [src/aircraft/da50rg/physics.ts, src/aircraft/da50rg/quantities.ts, src/aircraft/da50rg/cas.ts, scenarios/electrical/elec-altn1-fail.toon, tests/fixtures/scenarios/elec-ordered.toon, tests/physics.test.ts, tests/cas.test.ts, tests/variants.test.ts]
key-decisions:
  - "Decisions E-01 to E-11 of the plan stand; the owner confirmed E-05 (Volts bar on the essential bus) and E-11 (pump runs on the battery through the closed tie)."
requirements-completed: [SCN-11]
completed: 2026-10-23
---

# Phase 4 Plan 01: Electrical bus model Summary

The single-formula electrical model is replaced by `electricalState` in `electrical.ts`, which derives the tie relay (follows ESS BUS alone), main, essential, battery and avionic buses, the consumers, both alternator currents, Volts (essential bus) and the battery rate from control states, parameters and the battery charge. ALTN 1 FAIL and the new ALTN 2 FAIL come from the alternator control unit logic through hidden `alt1_fault` and `alt2_fault` quantities.

## What changed

- Task 1 (tracer, a374a42): `alternatorOnline`, `acuFault`, the fault quantities, the two cautions, alternator 2 parameters and trip; the shipped scenario and the ordered fixture start with `alt1_fault: 1`.
- Task 2 (9a4e5ab): `electricalState` and its table test typed from the five diagrams and Figure 1, each breaker alone, a 32-combination switch sweep and the load sharing direction (ESS BUS on: alternator 2 rises, alternator 1 falls). The old bus helpers and `ALT2_ESS_ON_AMPS` are gone from `physics.ts`.
- Task 3 (1580164): fuel pressure and the pump-alone fire feed need a live main bus (`emergPump`).
- c3c1255: the settled owner questions removed from the plan text.

## Checks

- Full vitest (53 files, 2855 tests), typecheck, lint, format:check and `npm run validate` pass.
- `tests/fixtures/recordings.json` is unchanged; all goldens keep their verdicts and `elec-do-nothing-long` still ends with `main_bus_lost` at 226.3 s.
- Playwright `pack`, `variants`, `run-reaction` on desktop-chromium and phone-chromium: 27 passed, 1 skipped (as before).
- The Volts bar bands in `quantities.ts` already matched the owner's bands (24.1, 25.0, 30.0, 32.0); no change.

## Deviations from Plan

None - plan executed as written. The private source photos were not re-read: the plan text carried every fact the code needed, and the table test pins it.

## Known Stubs

None.

## Self-Check: PASSED

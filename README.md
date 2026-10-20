# DA50 RG Procedure Trainer

Live site: https://bugwiper.github.io/procedure-trainer-da50/

[![CI and Deploy](https://github.com/bugwiper/procedure-trainer-da50/actions/workflows/deploy.yml/badge.svg)](https://github.com/bugwiper/procedure-trainer-da50/actions/workflows/deploy.yml)

**Training aid only, not the AFM. Not approved or certified, and not affiliated with Diamond Aircraft or Garmin.**

A web-based 2D cockpit procedure trainer for the Diamond DA50 RG, including emergency situations. The user operates an interactive panel and, in a quiz-style scenario, performs the checklist actions; performance is graded against stored required, optional and ordered actions.

## Demo controls

The panel has 23 controls in thirteen regions, placed where they sit in the real DA50 RG (the PFD and MFD regions are display artwork with no controls):

- **DE-ICE**, top far left: ALTERNATE (guarded)
- **ENGINE**, left edge below DE-ICE: FADEC (AUTO / FORCE B), FADEC TEST (push button), ALTERNATOR 1, ALTERNATOR 2
- **MFD SOFTKEYS**, under the MFD screen: MFD PAGE
- **SWITCH ROW**, under the PFD, left to right: PROP DE-ICE, FUEL TRANS, EMERG FUEL PUMP, ENGINE START (push button), ENGINE MASTER, ESS BUS, ELECT. MASTER, AV MASTER, PITOT/STALL HEAT
- **LANDING GEAR**, right of the switch row: GEAR
- **FLAPS**, below the MFD: FLAPS
- **RIGHT PANEL**, lower right: ELT
- **UNDER PANEL L**: ALTERNATE STATIC
- **UNDER PANEL C**: EMERGENCY GEAR EXTENSION (drag-only: tapping does nothing, the handle must be dragged all the way)
- **PEDESTAL**: POWER (0 to 100 % in 5 % steps), COWL FLAP (CLOSED / OPEN)
- **UNDER PANEL R**: ALTERNATE AIR

How it behaves:

- The panel opens in the normal in-flight configuration.
- ALTERNATE is the cockpit's only guarded switch: tap the guard to lift it, then tap the switch; the guard stays up until you tap it closed. ELECT. MASTER and ELT are red but unguarded and flip with one tap.
- ENGINE START and FADEC TEST show PRESSED while held and return to RELEASED when you let go, also when you slide off the button first.
- The other de-ice controls are out of scope for now.
- The panel keeps the true spacing and proportions of the aircraft, so some controls are small at the full view. On every device, a tap or click on a region's background zooms into it at full tap size; "Full panel" (or a double tap or double click) zooms out.
- Tapping a neutral area (panel background, display artwork, gaps between controls) never changes anything.
- The default positions and step sizes flagged as assumptions in the plans are still to be confirmed against the aircraft.

## Content policy

Read the [Content policy](docs/CONTENT-POLICY.md) before adding any scenario, procedure text or artwork. It exists to keep AFM-derived material out of this public repository beyond a small, well-defined limit.

## Development

```
npm ci                 # install dependencies
npm run dev            # start the dev server
npm run build          # production build
npm run typecheck      # type-check
npm run lint           # lint
npm run format:check   # check formatting
npm test               # unit tests
npm run e2e            # end-to-end tests
```

`BASE_PATH` sets the deploy base path (default "/").

## Stack

TypeScript 6.0, Vite 8, Preact 11 with signals, Vitest 5 and Playwright 1.64.

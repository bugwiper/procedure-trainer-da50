# DA50 RG Procedure Trainer

**Training aid only, not the AFM. Not approved or certified, and not affiliated with Diamond Aircraft or Garmin.**

A web-based 2D cockpit procedure trainer for the Diamond DA50 RG, including emergency situations. The user operates an interactive panel and, in a quiz-style scenario, performs the checklist actions; performance is graded against stored required, optional and ordered actions.

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

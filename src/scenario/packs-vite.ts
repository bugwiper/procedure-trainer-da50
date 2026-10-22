// The one place that globs scenario files (D-20, PLT-03): manifests are read eagerly (text, small),
// scenario files lazily, so Vite can emit one chunk per pack. Every other module reaches
// scenarios through VITE_PACKS and an AccessPolicy; tests/packs-seam (plan 07) gates that.

import { createPackProvider } from './packs';

const manifests = import.meta.glob<string>('/scenarios/*/pack.toon', {
  query: '?raw',
  import: 'default',
  eager: true,
});

const scenarios = import.meta.glob<string>(['/scenarios/*/*.toon', '!/scenarios/*/pack.toon'], {
  query: '?raw',
  import: 'default',
});

export const VITE_PACKS = createPackProvider({ manifests, loaders: scenarios });

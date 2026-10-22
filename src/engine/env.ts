// The aircraft a scenario is checked and run against: control registry and named quantities.
// Plan 08 adds the CAS rule table. Pure types, no DOM, no framework, no clock.

import type { QuantitySet } from './quantities';
import type { Registry } from './registry';

export interface AircraftEnv {
  readonly registry: Registry;
  readonly quantities: QuantitySet;
}

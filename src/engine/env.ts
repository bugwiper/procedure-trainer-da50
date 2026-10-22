// The aircraft a scenario is checked and run against: control registry, named quantities, the
// CAS rule table and the physics of the quantities. Pure types, no DOM, no framework, no clock.

import type { CasRuleSet } from './cas';
import type { Physics } from './physics';
import type { QuantitySet } from './quantities';
import type { Registry } from './registry';

export interface AircraftEnv {
  readonly registry: Registry;
  readonly quantities: QuantitySet;
  readonly cas: CasRuleSet;
  /** How the quantities move during a run (D-01); parameters a scenario may set. */
  readonly physics: Physics;
}

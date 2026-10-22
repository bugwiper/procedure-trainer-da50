// The aircraft a scenario is checked and run against: control registry, named quantities and the
// CAS rule table. Pure types, no DOM, no framework, no clock.

import type { CasRuleSet } from './cas';
import type { QuantitySet } from './quantities';
import type { Registry } from './registry';

export interface AircraftEnv {
  readonly registry: Registry;
  readonly quantities: QuantitySet;
  readonly cas: CasRuleSet;
}

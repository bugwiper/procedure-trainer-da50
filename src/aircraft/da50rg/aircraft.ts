import type { AircraftEnv } from '../../engine/env';
import { DA50RG_CAS } from './cas';
import { DA50RG } from './panel';
import { DA50RG_QUANTITIES } from './quantities';

/** The DA50 RG as scenarios see it: control registry, named quantities and CAS rules. */
export const DA50RG_ENV: AircraftEnv = Object.freeze({
  registry: DA50RG,
  quantities: DA50RG_QUANTITIES,
  cas: DA50RG_CAS,
});

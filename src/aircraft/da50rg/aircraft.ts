import type { AircraftEnv } from '../../engine/env';
import { DA50RG } from './panel';
import { DA50RG_QUANTITIES } from './quantities';

/** The DA50 RG as scenarios see it: control registry and named quantities. */
export const DA50RG_ENV: AircraftEnv = Object.freeze({
  registry: DA50RG,
  quantities: DA50RG_QUANTITIES,
});

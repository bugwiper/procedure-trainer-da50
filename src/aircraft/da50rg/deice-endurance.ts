// The endurance of the de-ice fluid (Phase 6, plan 02, E-07, E-08): how long the quantity in the
// tank lasts at the NORM flow and at the HIGH flow. The flows are the owner's TKS figures of
// 2026-10-28 (D-11); the fluid model in physics.ts uses the same constants, so the figures exist
// once. Pure TypeScript with + - * / and clamping only.

/** The fluid flow of de-ice mode NORM, US gallons per hour (owner, D-11). */
export const DEICE_NORM_GPH = 3;
/** The fluid flow of de-ice mode HIGH, US gallons per hour (owner, D-11). */
export const DEICE_HIGH_GPH = 6;

const MINUTES_PER_HOUR = 60;

export interface DeiceEndurance {
  /** Whole minutes at the NORM flow. */
  readonly normMin: number;
  /** Whole minutes at the HIGH flow. */
  readonly highMin: number;
}

/** Whole minutes a quantity lasts at a flow; 0 for an empty, negative or unreadable quantity. */
function minutesAt(quantityGal: number, flowGph: number): number {
  if (!Number.isFinite(quantityGal) || quantityGal <= 0) return 0;
  return Math.floor((quantityGal * MINUTES_PER_HOUR) / flowGph);
}

/** The Norm and High endurance of a de-ice quantity in US gallons: quantity over flow. */
export function deiceEndurance(quantityGal: number): DeiceEndurance {
  return {
    normMin: minutesAt(quantityGal, DEICE_NORM_GPH),
    highMin: minutesAt(quantityGal, DEICE_HIGH_GPH),
  };
}

import type { Page } from '@playwright/test';
import type { Point } from './zoom';

// Shared e2e touch helpers (zoom and press specs). This is test support, not a spec: its name
// does not end in .spec.ts, so Playwright never collects it.

export type TouchType = 'touchStart' | 'touchMove' | 'touchEnd';
export type TouchSender = (type: TouchType, points: Point[]) => Promise<void>;

/** Chromium touch emulation by CDP; point i has touch id i + 1. */
export async function touchSender(page: Page): Promise<TouchSender> {
  const cdp = await page.context().newCDPSession(page);
  return async (type, points) => {
    await cdp.send('Input.dispatchTouchEvent', {
      type,
      touchPoints: points.map((p, i) => ({ x: p.x, y: p.y, id: i + 1 })),
    });
  };
}

/** Two fingers on a horizontal line about `centre`, moving from `fromGap` to `toGap` apart. */
export async function pinch(
  page: Page,
  centre: Point,
  fromGap: number,
  toGap: number,
): Promise<void> {
  const send = await touchSender(page);
  const pair = (gap: number): Point[] => [
    { x: centre.x - gap / 2, y: centre.y },
    { x: centre.x + gap / 2, y: centre.y },
  ];
  await send('touchStart', pair(fromGap));
  for (let i = 1; i <= 8; i++) {
    await send('touchMove', pair(fromGap + ((toGap - fromGap) * i) / 8));
  }
  await send('touchEnd', []);
}

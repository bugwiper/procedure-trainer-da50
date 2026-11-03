import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  OFFLINE_READY_PREFIX,
  OFFLINE_UNAVAILABLE,
  UPDATE_BUTTON_LABEL,
  UPDATE_NOTICE_TEXT,
} from '../src/ui/pwa/update';

// D-11: everything that needs a real device is in docs/DEVICE-CHECKLIST.md. It is a living
// document in own words; this gate keeps it tied to the four roadmap criteria and to the strings
// the app really shows, so the two cannot drift apart.

const path = new URL('../docs/DEVICE-CHECKLIST.md', import.meta.url);
const text = existsSync(path) ? readFileSync(path, 'utf8') : '';

describe('docs/DEVICE-CHECKLIST.md', () => {
  it('exists', () => {
    expect(text.length).toBeGreaterThan(0);
  });

  it('lists the four roadmap criteria and closes each with a checkbox item', () => {
    for (const number of [1, 2, 3, 4]) {
      expect(text, `criterion ${number} listed`).toContain(`${number}. `);
      expect(text, `an item for criterion ${number}`).toMatch(
        new RegExp(`- \\[ \\] .*\\(Criteri(on|a) [^)]*\\b${number}\\b[^)]*\\)`),
      );
    }
  });

  it('names every platform of the criteria', () => {
    for (const name of [
      'iPhone',
      'iPad',
      'Safari',
      'Android',
      'Chrome',
      'Edge',
      'airplane mode',
      'standalone',
      '100dvh',
    ]) {
      expect(text, name).toContain(name);
    }
  });

  it('quotes the notice and the About lines of the code', () => {
    expect(text).toContain(UPDATE_NOTICE_TEXT);
    expect(text).toContain(UPDATE_BUTTON_LABEL);
    expect(text).toContain(OFFLINE_READY_PREFIX.trim());
    expect(text).toContain(OFFLINE_UNAVAILABLE);
  });

  it('blocks nothing and says so', () => {
    expect(text).toMatch(/blocks nothing/i);
  });

  it('names no private folder, no maker and no RUBIN mark', () => {
    expect(text).not.toMatch(/\.input/);
    expect(text).not.toMatch(/garmin|diamond|rubin|\bG1000\b|\bNXi\b/i);
  });
});

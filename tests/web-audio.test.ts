import { describe, expect, it } from 'vitest';
import type { ActiveCas } from '../src/engine/cas';
import { attachAural } from '../src/ui/audio/driver';
import type { AuralDeps } from '../src/ui/audio/driver';
import { SYNTH_BANK } from '../src/ui/audio/sounds';
import type { SoundBank } from '../src/ui/audio/sounds';
import { createSoundPlayer } from '../src/ui/audio/web-audio';

// The Web Audio glue and the driver against a fake context: nothing is created before enable(), a
// tone is requested once per appearing message, the engine follows the rpm, and nothing sounds while
// the run is not live. No audio is produced; the fake only counts.

class FakeParam {
  value = 0;
  calls = 0;
  setValueAtTime(): void {
    this.calls = this.calls + 1;
  }
  linearRampToValueAtTime(): void {
    this.calls = this.calls + 1;
  }
  setTargetAtTime(): void {
    this.calls = this.calls + 1;
  }
}

class FakeNode {
  gain = new FakeParam();
  frequency = new FakeParam();
  type = '';
  loop = false;
  buffer: unknown = null;
  connect(): void {}
  start(): void {}
  stop(): void {}
}

class FakeContext {
  state = 'suspended';
  currentTime = 0;
  sampleRate = 8000;
  destination = {};
  made = { oscillators: 0, gains: 0, sources: 0 };
  resumes = 0;
  suspends = 0;
  createGain(): FakeNode {
    this.made.gains = this.made.gains + 1;
    return new FakeNode();
  }
  createOscillator(): FakeNode {
    this.made.oscillators = this.made.oscillators + 1;
    return new FakeNode();
  }
  createBiquadFilter(): FakeNode {
    return new FakeNode();
  }
  createBuffer(_channels: number, frames: number): { getChannelData(): Float32Array } {
    const data = new Float32Array(frames);
    return { getChannelData: () => data };
  }
  createBufferSource(): FakeNode {
    this.made.sources = this.made.sources + 1;
    return new FakeNode();
  }
  resume(): Promise<void> {
    this.resumes = this.resumes + 1;
    this.state = 'running';
    return Promise.resolve();
  }
  suspend(): Promise<void> {
    this.suspends = this.suspends + 1;
    this.state = 'suspended';
    return Promise.resolve();
  }
}

function setup() {
  const created: FakeContext[] = [];
  const player = createSoundPlayer(() => {
    const ctx = new FakeContext();
    created.push(ctx);
    return ctx as unknown as AudioContext;
  });
  return { created, player };
}

const caution: ActiveCas = { id: 'c1', text: 'C ONE', level: 'caution' };
const warning: ActiveCas = { id: 'w1', text: 'W ONE', level: 'warning' };

describe('createSoundPlayer', () => {
  it('creates nothing before enable and ignores every request until then', () => {
    const { created, player } = setup();
    player.tone('caution');
    player.setEngine(100, 0.1);
    player.resume();
    expect(created).toHaveLength(0);
    expect(player.stats).toMatchObject({ enabled: false, tones: 0, engineGain: 0 });
  });

  it('enable creates one context, starts it and is repeatable', () => {
    const { created, player } = setup();
    expect(player.enable()).toBe(true);
    expect(player.enable()).toBe(true);
    expect(created).toHaveLength(1);
    expect(created[0]?.state).toBe('running');
    expect(player.stats.enabled).toBe(true);
  });

  it('reports false where there is no context', () => {
    const player = createSoundPlayer(() => null);
    expect(player.enable()).toBe(false);
    expect(player.stats.enabled).toBe(false);
  });

  it('one tone request makes one chime: a caution is a single oscillator, a warning three', () => {
    const { created, player } = setup();
    player.enable();
    player.tone('caution');
    expect(created[0]?.made.oscillators).toBe(1);
    expect(player.stats).toMatchObject({ tones: 1, lastTone: 'caution' });
    player.tone('warning');
    expect(created[0]?.made.oscillators).toBe(1 + 3);
    expect(player.stats).toMatchObject({ tones: 2, lastTone: 'warning' });
  });

  it('starts the engine only for a level above 0 and follows it', () => {
    const { created, player } = setup();
    player.enable();
    player.setEngine(0, 0);
    expect(created[0]?.made.sources).toBe(0);
    player.setEngine(90, 0.05);
    expect(created[0]?.made.sources).toBe(1);
    expect(created[0]?.made.oscillators).toBe(2);
    player.setEngine(100, 0.06);
    expect(created[0]?.made.sources).toBe(1);
    expect(player.stats).toMatchObject({ engineHz: 100, engineGain: 0.06 });
    player.setEngine(0, 0);
    expect(player.stats).toMatchObject({ engineHz: 0, engineGain: 0 });
  });

  it('disable silences and suspends; enable brings the same context back', () => {
    const { created, player } = setup();
    player.enable();
    player.setEngine(90, 0.05);
    player.disable();
    expect(player.stats).toMatchObject({ enabled: false, engineGain: 0 });
    expect(created[0]?.state).toBe('suspended');
    player.tone('caution');
    expect(player.stats.tones).toBe(0);
    player.enable();
    expect(created).toHaveLength(1);
    expect(created[0]?.state).toBe('running');
  });

  it('plays the sounds of an injected bank under their names', () => {
    const played: string[] = [];
    const bank: SoundBank = {
      caution: { play: () => played.push('caution') },
      warning: { play: () => played.push('warning') },
      engine: SYNTH_BANK.engine,
    };
    const ctx = new FakeContext();
    const player = createSoundPlayer(() => ctx as unknown as AudioContext, bank);
    player.enable();
    player.tone('warning');
    player.tone('caution');
    expect(played).toEqual(['warning', 'caution']);
  });
});

function driverSetup(over: Partial<AuralDeps> = {}) {
  const { created, player } = setup();
  const live = {
    wanted: true,
    running: true,
    blocked: false,
    hidden: false,
    cas: [] as readonly ActiveCas[],
    rpm: 2000,
    runMs: 0 as number | null,
  };
  const frames: (() => void)[] = [];
  const aural = attachAural({
    player,
    wanted: () => live.wanted,
    running: () => live.running,
    blocked: () => live.blocked,
    hidden: () => live.hidden,
    cas: () => live.cas,
    rpm: () => live.rpm,
    runMs: () => live.runMs,
    raf: (run) => frames.push(run),
    cancelRaf: () => undefined,
    ...over,
  });
  return { created, player, live, aural };
}

describe('attachAural', () => {
  it('stays silent until the player is enabled, then sounds a message that appears once', () => {
    const { player, live, aural } = driverSetup();
    live.cas = [caution];
    aural.update();
    expect(player.stats.tones).toBe(0);
    player.enable();
    live.cas = [caution, { ...warning }];
    aural.update();
    aural.update();
    expect(player.stats.tones).toBe(1);
    expect(player.stats.lastTone).toBe('warning');
  });

  it('sounds one chime per caution and the engine follows the rpm', () => {
    const { player, live, aural } = driverSetup();
    player.enable();
    aural.update();
    expect(player.stats.engineGain).toBeGreaterThan(0);
    live.cas = [caution];
    aural.update();
    aural.update();
    expect(player.stats.tones).toBe(1);
    live.rpm = 0;
    aural.update();
    expect(player.stats.engineGain).toBe(0);
  });

  it('is silent and suspended on the free panel, in a modal and in a hidden tab', () => {
    const { created, player, live, aural } = driverSetup();
    player.enable();
    live.cas = [caution];
    for (const off of ['running', 'blocked', 'hidden'] as const) {
      live.running = off !== 'running';
      live.blocked = off === 'blocked';
      live.hidden = off === 'hidden';
      aural.update();
      expect(player.stats).toMatchObject({ tones: 0, engineGain: 0 });
      expect(created[0]?.state).toBe('suspended');
    }
    live.running = true;
    live.blocked = false;
    live.hidden = false;
    aural.update();
    expect(player.stats.tones).toBe(1);
    expect(created[0]?.state).toBe('running');
  });

  it('does not sound again for a message already known when the run resumes', () => {
    const { player, live, aural } = driverSetup();
    player.enable();
    live.cas = [caution];
    aural.update();
    live.blocked = true;
    aural.update();
    live.blocked = false;
    aural.update();
    expect(player.stats.tones).toBe(1);
  });

  it('starts a new run with a fresh look: the same message sounds again', () => {
    const { player, live, aural } = driverSetup();
    player.enable();
    live.cas = [caution];
    aural.update();
    live.running = false;
    aural.update();
    live.running = true;
    aural.update();
    expect(player.stats.tones).toBe(2);
  });

  it('repeats a warning with the run time and stops at the limit', () => {
    const { player, live, aural } = driverSetup();
    player.enable();
    live.cas = [warning];
    for (let ms = 0; ms <= 60_000; ms += 100) {
      live.runMs = ms;
      aural.update();
    }
    expect(player.stats.tones).toBe(6);
  });

  it('press arms a remembered on and does nothing when the sound is not wanted', () => {
    const wanted = driverSetup();
    wanted.aural.press();
    expect(wanted.player.stats.enabled).toBe(true);
    const unwanted = driverSetup({ wanted: () => false });
    unwanted.aural.press();
    expect(unwanted.player.stats.enabled).toBe(false);
  });
});

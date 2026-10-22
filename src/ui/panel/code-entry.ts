// Entry rules of the code-entry unit (D-11, C-15, C-16). No DOM, no framework: the buffer and the
// key press factory are unit tested in the node environment. The partial entry lives here, in the
// widget, and never reaches the store; only a complete code is dispatched (T-03-06).

import { CODE_ENTRY_CLEAR_KEY } from '../../engine/registry';
import type { CodeEntryDef } from '../../engine/registry';
import type { DispatchResult } from '../../engine/store';
import { seqOf } from './press-targets';
import type { PressTarget } from './press-targets';

/** What pushing a key did: the entry is still being typed, or a full code is ready to commit. */
export type EntryResult =
  | { readonly kind: 'typing'; readonly buffer: string }
  | { readonly kind: 'commit'; readonly code: string };

export interface EntryBuffer {
  /** Appends one character; the last one of `digits` returns the code and empties the buffer. */
  push(key: string): EntryResult;
  /** Empties a partial entry (the CLR key). */
  clear(): void;
  /** The characters typed so far, empty at rest. */
  readonly value: string;
}

/** A buffer for codes of `digits` characters. */
export function createEntryBuffer(digits: number): EntryBuffer {
  if (!Number.isInteger(digits) || digits < 1) {
    throw new RangeError(`an entry buffer needs a whole number of digits (got ${String(digits)})`);
  }
  let typed = '';
  return {
    push(key) {
      if ([...key].length !== 1) {
        throw new RangeError(`an entry key is one character (got "${key}")`);
      }
      typed += key;
      if (typed.length < digits) return { kind: 'typing', buffer: typed };
      const code = typed;
      typed = '';
      return { kind: 'commit', code };
    },
    clear() {
      typed = '';
    },
    get value() {
      return typed;
    },
  };
}

export interface CodeKeyPressDeps {
  readonly def: Pick<CodeEntryDef, 'id'>;
  /** The key id: one alphabet character, or CODE_ENTRY_CLEAR_KEY. */
  readonly key: string;
  readonly buffer: EntryBuffer;
  readonly actuate: (id: string, value: string) => DispatchResult;
  /** Called after every change of the buffer, so the readout can follow. */
  readonly onChange: () => void;
}

/**
 * The press target of one key (C-15, C-16): a momentary target whose press appends the character
 * (or empties the buffer for CLR) and, when the last digit completes the code, dispatches the
 * whole code and returns the sequence number of the event. A partial entry returns null, and so
 * does re-entering the committed code (the store answers unchanged). Release and discard change
 * nothing, and the class is momentary, so a key never zooms, never pairs and never retracts
 * (PNL-15): the same key can be tapped twice quickly to type 7700.
 */
export function makeCodeKeyPress(deps: CodeKeyPressDeps): PressTarget {
  const { def, key, buffer, actuate, onChange } = deps;
  return {
    cls: 'momentary',
    press() {
      if (key === CODE_ENTRY_CLEAR_KEY) {
        buffer.clear();
        onChange();
        return null;
      }
      const result = buffer.push(key);
      onChange();
      return result.kind === 'commit' ? seqOf(actuate(def.id, result.code)) : null;
    },
    release() {
      // The press already did everything; a key has no held state.
    },
    discard() {
      // A press that was taken away before its commit never changed anything.
    },
  };
}

// Scenario and manifest text to a validated value (D-19, SCN-01). Author errors come back as
// issues, never as exceptions, and every issue carries a line and a column: a decoder error its
// decoder line, a schema error the position of its path in the text (toon-index), an oversized
// text line 1. Only a programmer error (an unexpected exception from the decoder) is rethrown.
// Pure TypeScript, no DOM, no framework, no clock (enforced by the ESLint boundary).

import { decode, ToonDecodeError } from '@toon-format/toon';
import { z } from 'zod';
import { Manifest, Scenario } from './schema';
import { indexToon, locate } from './toon-index';
import type { PathSegment } from './toon-index';

/** Texts longer than this are refused before decoding (T-02-03). */
export const MAX_TEXT_LENGTH = 262144;

export interface ScenarioIssue {
  /** Dot-joined path of the offending field; empty-path issues read "(root)". */
  readonly path: string;
  readonly message: string;
  /** 1-based. */
  readonly line: number;
  /** 1-based; decoder issues report column 1. */
  readonly col: number;
}

export type ParseResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly issues: readonly ScenarioIssue[] };

/** The display form of a path: segments joined by dots, "(root)" for the empty path. */
export const joinPath = (path: readonly PropertyKey[]): string =>
  path.length === 0 ? '(root)' : path.map((part) => String(part)).join('.');

const segmentsOf = (path: readonly PropertyKey[]): PathSegment[] =>
  path.map((part) => (typeof part === 'number' ? part : String(part)));

function zodIssues(error: z.ZodError, text: string): ScenarioIssue[] {
  const index = indexToon(text);
  const at = (path: readonly PropertyKey[], message: string): ScenarioIssue => ({
    path: joinPath(path),
    message,
    ...locate(index, segmentsOf(path)),
  });
  return error.issues.flatMap((issue): ScenarioIssue[] => {
    if (issue.code === 'unrecognized_keys') {
      return issue.keys.map((key) => at([...issue.path, key], `unknown key "${key}"`));
    }
    return [at(issue.path, issue.message)];
  });
}

function parseText<T>(text: string, schema: z.ZodType<T>): ParseResult<T> {
  if (text.length > MAX_TEXT_LENGTH) {
    return {
      ok: false,
      issues: [
        {
          path: '(root)',
          line: 1,
          col: 1,
          message: `text has ${String(text.length)} characters, more than the limit of ${String(MAX_TEXT_LENGTH)}`,
        },
      ],
    };
  }
  let decoded: unknown;
  try {
    decoded = decode(text);
  } catch (error) {
    if (error instanceof ToonDecodeError) {
      const issue: ScenarioIssue = {
        path: '(root)',
        message: error.message.replace(/^Line \d+:\s*/, ''),
        line: error.line ?? 1,
        col: 1,
      };
      return { ok: false, issues: [issue] };
    }
    throw error;
  }
  const result = schema.safeParse(decoded);
  if (result.success) return { ok: true, value: result.data };
  return { ok: false, issues: zodIssues(result.error, text) };
}

export function parseScenario(text: string): ParseResult<Scenario> {
  return parseText(text, Scenario);
}

export function parseManifest(text: string): ParseResult<Manifest> {
  return parseText(text, Manifest);
}

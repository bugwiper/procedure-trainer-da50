// Scenario and manifest text to a validated value (D-19, SCN-01). Author errors come back as
// issues, never as exceptions: a decoder error carries its line, a schema error its dot path, an
// oversized text one issue before decoding. Only a programmer error (an unexpected exception from
// the decoder) is rethrown.
// Pure TypeScript, no DOM, no framework, no clock (enforced by the ESLint boundary).

import { decode, ToonDecodeError } from '@toon-format/toon';
import { z } from 'zod';
import { Manifest, Scenario } from './schema';

/** Texts longer than this are refused before decoding (T-02-03). */
export const MAX_TEXT_LENGTH = 262144;

export interface ScenarioIssue {
  /** Dot-joined path of the offending field; empty-path issues read "(root)". */
  readonly path: string;
  readonly message: string;
  /** 1-based; set for decoder issues here, for schema and lint issues from plan 05 on. */
  readonly line?: number;
  readonly col?: number;
}

export type ParseResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly issues: readonly ScenarioIssue[] };

const joinPath = (path: readonly PropertyKey[]): string =>
  path.length === 0 ? '(root)' : path.map((part) => String(part)).join('.');

function zodIssues(error: z.ZodError): ScenarioIssue[] {
  return error.issues.flatMap((issue): ScenarioIssue[] => {
    if (issue.code === 'unrecognized_keys') {
      return issue.keys.map((key) => ({
        path: joinPath([...issue.path, key]),
        message: `unknown key "${key}"`,
      }));
    }
    return [{ path: joinPath(issue.path), message: issue.message }];
  });
}

function parseText<T>(text: string, schema: z.ZodType<T>): ParseResult<T> {
  if (text.length > MAX_TEXT_LENGTH) {
    return {
      ok: false,
      issues: [
        {
          path: '(root)',
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
        ...(error.line !== undefined ? { line: error.line } : {}),
      };
      return { ok: false, issues: [issue] };
    }
    throw error;
  }
  const result = schema.safeParse(decoded);
  if (result.success) return { ok: true, value: result.data };
  return { ok: false, issues: zodIssues(result.error) };
}

export function parseScenario(text: string): ParseResult<Scenario> {
  return parseText(text, Scenario);
}

export function parseManifest(text: string): ParseResult<Manifest> {
  return parseText(text, Manifest);
}

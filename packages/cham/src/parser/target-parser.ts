// ─── Target Parser ─────────────────────────────────────────────
// Parses all annotation target syntaxes into AnnotationTarget models.
// This is the single place that knows CHAM target syntax —
// adding a new syntax form = adding a parser function here.

import type { AnnotationTarget } from '../types.js'

export interface TargetParseResult {
  readonly target: AnnotationTarget
  /** Number of characters consumed from the start of the annotation line. */
  readonly consumed: number
}

/**
 * Parse a target reference from the start of an annotation line.
 *
 * Recognized syntaxes (checked in order of specificity):
 *   {N}              → marker
 *   @title           → title
 *   @full            → full
 *   @verse:N:C-E     → verse (also @position: alias)
 *   @v:N             → verse-all
 *   @[quote]         → text (search all verses)
 *   @N[quote]        → text with verse hint (disambiguation)
 *
 * The character at position `consumed` must be whitespace or end-of-line.
 * This prevents `@titlefoo` or `{1}meaning` from being silently accepted
 * as `title` / `marker` targets.
 *
 * @returns null if the input doesn't start with a recognized target syntax
 *          or if the syntax is malformed.
 */
export function parseTarget(line: string): TargetParseResult | null {
  // Inline marker: {N}
  if (line.startsWith('{')) return parseMarkerTarget(line)
  if (!line.startsWith('@')) return null

  // Special targets
  if (line.startsWith('@title')) return makeResult({ type: 'title' }, 6, line)
  if (line.startsWith('@full')) return makeResult({ type: 'full' }, 5, line)

  // Position targets: @verse:N:C-E or @position:N:C-E
  if (line.startsWith('@verse:') || line.startsWith('@position:')) {
    return parsePositionTarget(line)
  }

  // Entire-verse target: @v:N
  if (line.startsWith('@v:')) {
    return parseVerseAllTarget(line)
  }

  // Text-quote with verse hint: @N[quote]
  const hintedMatch = line.match(/^@(\d+)\[/)
  if (hintedMatch) {
    return parseTextQuoteTarget(line, parseInt(hintedMatch[1], 10), hintedMatch[0].length)
  }

  // Text-quote without hint: @[quote]
  if (line.startsWith('@[')) {
    return parseTextQuoteTarget(line, undefined, 2)
  }

  return null
}

// ─── Individual Parsers ────────────────────────────────────────

function parseMarkerTarget(line: string): TargetParseResult | null {
  const closeIdx = line.indexOf('}')
  if (closeIdx === -1) return null
  const idStr = line.slice(1, closeIdx)
  if (!/^\d+$/.test(idStr)) return null
  return makeResult({ type: 'marker', markerId: parseInt(idStr, 10) }, closeIdx + 1, line)
}

function parsePositionTarget(line: string): TargetParseResult | null {
  const prefix = line.startsWith('@verse:') ? '@verse:' : '@position:'
  const spec = line.slice(prefix.length).split(/\s/)[0]
  // spec must be `LINE`, `LINE:CHAR`, or `LINE:CHAR-END`.
  const match = spec.match(/^(\d+)(?::(\d+)(?:-(\d+))?)?$/)
  if (!match) return null

  const lineNum = parseInt(match[1], 10)
  const char = match[2] !== undefined ? parseInt(match[2], 10) : 0
  const target: AnnotationTarget = match[3] !== undefined
    ? { type: 'verse', line: lineNum, char, end: parseInt(match[3], 10) }
    : match[2] !== undefined
      ? { type: 'verse', line: lineNum, char }
      : { type: 'verse', line: lineNum, char: 0 }
  return makeResult(target, prefix.length + spec.length, line)
}

function parseVerseAllTarget(line: string): TargetParseResult | null {
  const spec = line.slice(3).split(/\s/)[0]  // after '@v:'
  if (!/^\d+$/.test(spec)) return null
  return makeResult({ type: 'verse-all', line: parseInt(spec, 10) }, 3 + spec.length, line)
}

/**
 * Parse a text-quote target starting after the opening bracket position.
 * `bracketStart` is the index in `line` just after the `[`.
 * So for `@[quote]`, bracketStart = 2. For `@3[quote]`, bracketStart = 4.
 */
function parseTextQuoteTarget(
  line: string,
  verseHint: number | undefined,
  bracketStart: number,
): TargetParseResult | null {
  const closeIdx = line.indexOf(']', bracketStart)
  if (closeIdx === -1) return null
  const quote = line.slice(bracketStart, closeIdx)
  if (quote.length === 0) return null
  const target: AnnotationTarget = verseHint !== undefined
    ? { type: 'text', quote, verseHint }
    : { type: 'text', quote }
  return makeResult(target, closeIdx + 1, line)
}

/**
 * Build a result, verifying that the consumed characters are followed by
 * whitespace or end-of-line. Rejects inputs like `@titlefoo` or `{1}meaning`
 * that would otherwise be silently accepted as `title` / `marker` targets.
 */
function makeResult(target: AnnotationTarget, consumed: number, line: string): TargetParseResult | null {
  const next = line[consumed]
  if (next !== undefined && !/\s/.test(next)) return null
  return { target, consumed }
}

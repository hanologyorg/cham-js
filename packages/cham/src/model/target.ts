// ─── Annotation Target Model ───────────────────────────────────
// Centralizes all annotation target operations: sorting, categorization,
// and resolution requirements. This is the single place that knows
// about target types — parser, serializer, pipeline, and validator
// all delegate here instead of switching on target types themselves.

import type { AnnotationTarget } from '../types.js'

// ─── Target Categories ─────────────────────────────────────────
// Used for validation dispatch and rule categorization.

export type TargetCategory = 'marker' | 'position' | 'text' | 'special'

/**
 * Classifies a target into a category for validation and processing dispatch.
 *
 * - `marker`: Inline marker reference `{N}` — resolved via the marker table.
 * - `position`: Direct verse/character reference — resolved by position lookup.
 * - `text`: External text-quote reference — resolved via text search index.
 * - `special`: Title or full-document targets — no resolution needed.
 */
export function targetCategory(target: AnnotationTarget): TargetCategory {
  switch (target.type) {
    case 'marker': return 'marker'
    case 'verse': return 'position'
    case 'verse-all': return 'position'
    case 'text': return 'text'
    case 'title': return 'special'
    case 'full': return 'special'
  }
}

/**
 * Whether this target requires resolution against a primary document's
 * text or marker table before it can produce a concrete range.
 *
 * Special targets (title, full) need no resolution — they have fixed ranges.
 */
export function requiresResolution(target: AnnotationTarget): boolean {
  return target.type !== 'title' && target.type !== 'full'
}

/**
 * Canonical sort key for targets, used by the serializer to order
 * annotation entries within a section.
 *
 * Returns a 3-tuple: [primaryOrder, secondaryOrder, tertiaryOrder].
 * Lower tuples sort first.
 *
 * - `title` sorts first (before any positional target).
 * - `marker` sorts by marker ID.
 * - `position` targets (verse, verse-all) sort by [line, char, end].
 * - `text` targets cannot be positionally sorted before resolution.
 *   With a verse hint, sort by hint. Without, sort after every positional
 *   target but before `full` (tertiary=1 vs full's tertiary=0 keeps them
 *   deterministic and separated).
 * - `full` sorts last (after everything).
 */
export function targetSortKey(target: AnnotationTarget): [number, number, number] {
  switch (target.type) {
    case 'title':
      return [-1, 0, 0]
    case 'full':
      return [Infinity, 0, 0]
    case 'marker':
      return [target.markerId, 0, 0]
    case 'verse':
      return [target.line, target.char, target.end ?? target.char]
    case 'verse-all':
      return [target.line, 0, 0]
    case 'text':
      return [target.verseHint ?? Number.MAX_SAFE_INTEGER, 0, 1]
  }
}

/**
 * Human-readable description of a target for error messages and debugging.
 */
export function describeTarget(target: AnnotationTarget): string {
  switch (target.type) {
    case 'marker': return `{${target.markerId}}`
    case 'verse': {
      const end = target.end !== undefined ? `-${target.end}` : ''
      return `@verse:${target.line}:${target.char}${end}`
    }
    case 'verse-all': return `@v:${target.line}`
    case 'text': {
      const hint = target.verseHint !== undefined ? `${target.verseHint}` : ''
      return `@${hint}[${target.quote}]`
    }
    case 'title': return '@title'
    case 'full': return '@full'
  }
}

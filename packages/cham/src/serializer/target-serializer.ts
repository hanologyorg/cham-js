// ─── Target Serializer ─────────────────────────────────────────
// Serializes AnnotationTarget models back to CHAM syntax strings.
// This is the single place that knows how to format targets —
// the inverse of parseTarget().

import type { AnnotationTarget } from '../types.js'

/**
 * Serialize a target to its CHAM markdown syntax.
 *
 * Guarantees: `parseTarget(serializeTarget(t))?.target` deeply equals `t`
 * for all well-formed targets.
 */
export function serializeTarget(target: AnnotationTarget): string {
  switch (target.type) {
    case 'marker':
      return `{${target.markerId}}`

    case 'verse': {
      const end = target.end !== undefined ? `-${target.end}` : ''
      return `@verse:${target.line}:${target.char}${end}`
    }

    case 'verse-all':
      return `@v:${target.line}`

    case 'text': {
      const prefix = target.verseHint !== undefined ? `@${target.verseHint}` : '@'
      return `${prefix}[${target.quote}]`
    }

    case 'title':
      return '@title'

    case 'full':
      return '@full'
  }
}

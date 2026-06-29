// Rule: marker-interleaving
// Category: marker
// Validates that `{N}` and `{/N}` markers are properly opened and closed.

import type { ValidationRule, ValidationContext } from '../validation-rule.js'
import { BaseRule } from '../rule-helpers.js'

interface MarkerEvent { id: number; offset: number; type: 'open' | 'close' }

export class MarkerInterleavingRule extends BaseRule implements ValidationRule {
  readonly id = 'marker-interleaving'
  readonly category = 'marker' as const
  readonly description = 'Open/close marker pairs are properly nested'

  check(ctx: ValidationContext) {
    const doc = ctx.doc
    const issues = []
    const textSource = doc.textBlocks.map(b => b.source).join('\n\n')

    const events: MarkerEvent[] = []
    for (const m of [...textSource.matchAll(/\{\/?(\d+)\}/g)]) {
      const isClose = m[0].includes('/')
      events.push({ id: parseInt(m[1], 10), offset: m.index!, type: isClose ? 'close' : 'open' })
    }
    events.sort((a, b) => a.offset - b.offset)

    const openIds = new Map<number, number>()
    for (const ev of events) {
      if (ev.type === 'open') {
        const count = openIds.get(ev.id) || 0
        if (count > 0) {
          issues.push(this.error(ctx, undefined, `Duplicate open marker {${ev.id}} without close`))
        }
        openIds.set(ev.id, count + 1)
      } else {
        const count = openIds.get(ev.id) || 0
        if (count === 0) {
          issues.push(this.error(ctx, undefined, `Orphan close marker {/${ev.id}}`))
        } else {
          openIds.set(ev.id, count - 1)
        }
      }
    }
    for (const [id, count] of openIds) {
      if (count > 0) {
        issues.push(this.error(ctx, undefined, `Unclosed marker {${id}}`))
      }
    }
    return issues
  }
}

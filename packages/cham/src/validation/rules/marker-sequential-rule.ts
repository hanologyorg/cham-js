// Rule: marker-sequential
// Category: marker
// Warns when marker IDs are non-sequential (gaps in numbering).

import type { ValidationRule, ValidationContext } from '../validation-rule.js'
import { BaseRule } from '../rule-helpers.js'

export class MarkerSequentialRule extends BaseRule implements ValidationRule {
  readonly id = 'marker-sequential'
  readonly category = 'marker' as const
  readonly description = 'Warns on non-sequential marker numbering'

  check(ctx: ValidationContext) {
    const doc = ctx.doc
    if (doc.markers.size === 0) return []
    const issues = []
    const ids = [...doc.markers.keys()].sort((a, b) => a - b)
    for (let i = 1; i < ids.length; i++) {
      if (ids[i] !== ids[i - 1] + 1) {
        issues.push(this.warning(ctx, undefined,
          `Non-sequential marker numbering: ${ids[i - 1]} → ${ids[i]} (gap detected)`))
      }
    }
    return issues
  }
}

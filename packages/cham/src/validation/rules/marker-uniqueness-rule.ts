// Rule: marker-uniqueness
// Category: marker
// Validates that marker IDs are unique (no reused IDs across blocks).

import type { ValidationRule, ValidationContext } from '../validation-rule.js'
import { BaseRule } from '../rule-helpers.js'

export class MarkerUniquenessRule extends BaseRule implements ValidationRule {
  readonly id = 'marker-uniqueness'
  readonly category = 'marker' as const
  readonly description = 'Marker IDs are not reused across text blocks'

  check(ctx: ValidationContext) {
    const issues = []
    const seen = new Map<number, number>()
    for (const [id, marker] of ctx.doc.markers) {
      if (seen.has(id)) {
        issues.push(this.error(ctx, undefined,
          `Marker ID {${id}} is reused (first in block ${seen.get(id)}, again in block ${marker.blockIndex})`))
      }
      seen.set(id, marker.blockIndex)
    }
    return issues
  }
}

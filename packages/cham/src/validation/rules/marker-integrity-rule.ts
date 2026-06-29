// Rule: marker-integrity
// Category: marker
// Validates that marker.text matches the actual text at marker.offset..offset+length.

import type { ValidationRule, ValidationContext } from '../validation-rule.js'
import { BaseRule } from '../rule-helpers.js'

export class MarkerIntegrityRule extends BaseRule implements ValidationRule {
  readonly id = 'marker-integrity'
  readonly category = 'marker' as const
  readonly description = 'Marker text matches the text block slice at the marker offset'

  check(ctx: ValidationContext) {
    const doc = ctx.doc
    const issues = []
    for (const [id, marker] of doc.markers) {
      if (marker.length > 0 && marker.text) {
        const block = doc.textBlocks[marker.blockIndex]
        if (block) {
          const actual = block.text.slice(marker.offset, marker.offset + marker.length)
          if (actual !== marker.text) {
            issues.push(this.warning(ctx, undefined,
              `Marker ${id} text mismatch: expected "${marker.text}", got "${actual}"`))
          }
        }
      }
    }
    return issues
  }
}

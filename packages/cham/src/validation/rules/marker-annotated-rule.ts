// Rule: marker-annotated
// Category: marker
// Validates that every marker has at least one annotation entry,
// either in the primary document or in any secondary (commentary) file.

import type { ValidationRule, ValidationContext } from '../validation-rule.js'
import type { ValidationIssue } from '../../types.js'
import { BaseRule, isPrimary } from '../rule-helpers.js'

export class MarkerAnnotatedRule extends BaseRule implements ValidationRule {
  readonly id = 'marker-annotated'
  readonly category = 'marker' as const
  readonly description = 'Every marker has at least one annotation referencing it'

  check(ctx: ValidationContext) {
    // Only run on primary documents — secondary files don't own markers.
    if (!isPrimary(ctx.doc)) return []

    const issues: ValidationIssue[] = []
    const annotatedMarkers = new Set<number>()

    // Primary's own annotations
    for (const section of ctx.doc.sections) {
      for (const entry of section.entries) {
        if (entry.target.type === 'marker') {
          annotatedMarkers.add(entry.target.markerId)
        }
      }
    }

    // Secondary file annotations (cross-file context)
    if (ctx.secondaryMarkerRefs) {
      for (const id of ctx.secondaryMarkerRefs) {
        annotatedMarkers.add(id)
      }
    }

    for (const [id] of ctx.doc.markers) {
      if (!annotatedMarkers.has(id)) {
        issues.push(this.warning(ctx, undefined, `Marker {${id}} has no annotation entry`))
      }
    }
    return issues
  }
}

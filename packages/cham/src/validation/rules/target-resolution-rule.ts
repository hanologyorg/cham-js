// Rule: target-resolution
// Category: target
// Validates that all annotation targets resolve (markers exist, text quotes found).

import type { ValidationRule, ValidationContext } from '../validation-rule.js'
import type { ValidationIssue } from '../../types.js'
import { BaseRule } from '../rule-helpers.js'

export class TargetResolutionRule extends BaseRule implements ValidationRule {
  readonly id = 'target-resolution'
  readonly category = 'target' as const
  readonly description = 'All annotation targets resolve to a concrete text range'

  check(ctx: ValidationContext) {
    const { doc, resolver, primaryDoc } = ctx
    const issues: ValidationIssue[] = []

    // Use the resolver for text-quote targets; fall back to marker-table check otherwise.
    const targetDoc = primaryDoc ?? doc
    for (const section of doc.sections) {
      for (const entry of section.entries) {
        if (entry.target.type === 'marker') {
          if (!targetDoc.markers.has(entry.target.markerId)) {
            issues.push(this.error(ctx, undefined,
              `Annotation references missing marker {${entry.target.markerId}}`))
          }
        } else if (entry.target.type === 'text' && resolver) {
          const resolved = resolver.tryResolve(entry.target)
          if (!resolved) {
            const hint = entry.target.verseHint !== undefined
              ? ` in verse ${entry.target.verseHint}`
              : ''
            issues.push(this.warning(ctx, undefined,
              `Unresolvable text-quote target${hint}: "${entry.target.quote}"`))
          }
        }
      }
    }
    return issues
  }
}

// Rule: hierarchy
// Category: structure
// Validates hierarchy levels and parent refs against piece IDs.

import type { ValidationRule, ValidationContext } from '../validation-rule.js'
import type { ValidationIssue, PrimaryMeta } from '../../types.js'
import { BaseRule, isPrimary } from '../rule-helpers.js'

export class HierarchyRule extends BaseRule implements ValidationRule {
  readonly id = 'hierarchy'
  readonly category = 'structure' as const
  readonly description = 'Hierarchy levels and parent refs are valid'

  check(ctx: ValidationContext) {
    const { doc, bookConfig } = ctx
    if (!bookConfig?.hierarchy || !isPrimary(doc)) return []
    const pm = doc.meta as PrimaryMeta
    if (!pm.hierarchy) return []

    const validLevels = new Set(bookConfig.hierarchy)
    const issues: ValidationIssue[] = []

    // Validate that hierarchy levels are known; parent refs checked at book level
    // (not here, since we don't have all piece IDs in a single-doc context).
    for (const h of pm.hierarchy) {
      if (!validLevels.has(h.level)) {
        issues.push(this.warning(ctx, undefined,
          `Hierarchy level "${h.level}" not in book scheme ${JSON.stringify(bookConfig.hierarchy)}`))
      }
    }

    return issues
  }
}

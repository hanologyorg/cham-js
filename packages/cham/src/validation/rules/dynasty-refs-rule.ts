// Rule: dynasty-refs
// Category: registry
// Validates that dynasty values in frontmatter point to known dynasty records.

import type { ValidationRule, ValidationContext } from '../validation-rule.js'
import { BaseRule } from '../rule-helpers.js'

export class DynastyRefsRule extends BaseRule implements ValidationRule {
  readonly id = 'dynasty-refs'
  readonly category = 'registry' as const
  readonly description = 'Dynasty values point to known dynasty records'

  check(ctx: ValidationContext) {
    const { doc, registries } = ctx
    if (!registries?.dynasties || registries.dynasties.length === 0) return []
    const dynastyKeys = new Set(registries.dynasties.map(d => d.id))
    const issues = []

    const fm = doc.meta as unknown as Record<string, unknown>
    const date = fm.date as Record<string, unknown> | undefined
    if (date && typeof date === 'object' && 'dynasty' in date) {
      const dyn = date.dynasty as string
      if (dyn && !dynastyKeys.has(dyn)) {
        issues.push(this.warning(ctx, undefined, `Dynasty "${dyn}" not found in dynasties registry`))
      }
    }
    return issues
  }
}

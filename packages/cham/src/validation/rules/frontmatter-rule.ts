// Rule: frontmatter-required
// Category: frontmatter
// Checks that primary files have required fields (id, title)
// and secondary files have required fields (base).

import type { ValidationRule, ValidationContext } from '../validation-rule.js'
import { BaseRule } from '../rule-helpers.js'

export class FrontmatterRequiredRule extends BaseRule implements ValidationRule {
  readonly id = 'frontmatter-required'
  readonly category = 'frontmatter' as const
  readonly description = 'Required frontmatter fields per meta type'

  check(ctx: ValidationContext) {
    const issues = []
    const doc = ctx.doc

    if (doc.meta.type === 'primary') {
      if (doc.meta.id === undefined || doc.meta.id === '') {
        issues.push(this.error(ctx, undefined, 'Primary file missing required field: id'))
      }
      if (!doc.meta.title) {
        issues.push(this.error(ctx, undefined, 'Primary file missing required field: title'))
      }
    } else if (doc.meta.type === 'secondary') {
      if (!doc.meta.base) {
        issues.push(this.error(ctx, undefined, 'Secondary file missing required field: base'))
      }
      if (!doc.meta.contributor) {
        issues.push(this.warning(ctx, undefined, 'Secondary file missing recommended field: contributor'))
      }
      if (!doc.meta.role) {
        issues.push(this.warning(ctx, undefined, 'Secondary file missing recommended field: role'))
      }
    }
    return issues
  }
}

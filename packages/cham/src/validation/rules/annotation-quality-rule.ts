// Rule: annotation-quality
// Category: quality
// Warns on empty annotation values (except variant kind, which may be value-less).

import type { ValidationRule, ValidationContext } from '../validation-rule.js'
import { BaseRule } from '../rule-helpers.js'

export class AnnotationQualityRule extends BaseRule implements ValidationRule {
  readonly id = 'annotation-quality'
  readonly category = 'quality' as const
  readonly description = 'Warns on empty annotation values'

  check(ctx: ValidationContext) {
    const issues = []
    for (const section of ctx.doc.sections) {
      for (const entry of section.entries) {
        if (!entry.value && entry.kind !== 'variant') {
          issues.push(this.warning(ctx, undefined,
            `Empty annotation value for ${JSON.stringify(entry.target)}`))
        }
      }
    }
    return issues
  }
}

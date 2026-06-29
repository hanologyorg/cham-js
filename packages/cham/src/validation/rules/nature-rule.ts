// Rule: nature-valid
// Category: quality
// Validates that @nature values are known classical/general natures.

import type { ValidationRule, ValidationContext } from '../validation-rule.js'
import { BaseRule } from '../rule-helpers.js'
import { VALID_NATURES } from '../../types.js'

export class NatureValidRule extends BaseRule implements ValidationRule {
  readonly id = 'nature-valid'
  readonly category = 'quality' as const
  readonly description = '@nature values are known classical/general natures'

  check(ctx: ValidationContext) {
    const issues = []
    for (const section of ctx.doc.sections) {
      if (section.meta.nature && !VALID_NATURES.has(section.meta.nature)) {
        issues.push(this.warning(ctx, undefined,
          `Unknown @nature value: "${section.meta.nature}"`))
      }
    }
    return issues
  }
}

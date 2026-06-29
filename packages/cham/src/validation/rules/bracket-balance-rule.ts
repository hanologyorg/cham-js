// Rule: bracket-balance
// Category: structure
// Validates that `[` and `]` are balanced in annotation values.

import type { ValidationRule, ValidationContext } from '../validation-rule.js'
import type { ValidationIssue } from '../../types.js'
import { BaseRule } from '../rule-helpers.js'

export class BracketBalanceRule extends BaseRule implements ValidationRule {
  readonly id = 'bracket-balance'
  readonly category = 'structure' as const
  readonly description = 'Brackets `[` `]` are balanced in annotation values'

  check(ctx: ValidationContext) {
    const issues: ValidationIssue[] = []
    for (const section of ctx.doc.sections) {
      for (const entry of section.entries) {
        let depth = 0
        let unbalanced = false
        for (const ch of entry.value) {
          if (ch === '[') depth++
          else if (ch === ']') depth--
          if (depth < 0) { unbalanced = true; break }
        }
        if (unbalanced || depth > 0) {
          issues.push(this.warning(ctx, undefined,
            `Unbalanced brackets in annotation value for ${JSON.stringify(entry.target)}`))
        }
      }
    }
    return issues
  }
}

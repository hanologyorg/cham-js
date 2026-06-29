// Rule: nested-brackets
// Category: structure
// Warns on nested `[` `]` in annotation values (should use full-width （ ）).

import type { ValidationRule, ValidationContext } from '../validation-rule.js'
import type { ValidationIssue } from '../../types.js'
import { BaseRule } from '../rule-helpers.js'

export class NestedBracketsRule extends BaseRule implements ValidationRule {
  readonly id = 'nested-brackets'
  readonly category = 'structure' as const
  readonly description = 'Warns on nested `[` `]` in annotation values'

  check(ctx: ValidationContext) {
    const issues: ValidationIssue[] = []
    for (const section of ctx.doc.sections) {
      for (const entry of section.entries) {
        if (entry.value.includes('[') || entry.value.includes(']')) {
          issues.push(this.warning(ctx, undefined,
            `Nested brackets in annotation value for ${JSON.stringify(entry.target)} — use full-width （ ） instead`))
        }
      }
    }
    return issues
  }
}

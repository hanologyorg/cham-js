// Rule: speaker
// Category: kind
// Validates speaker annotations: must target a text range (not title/full)
// and have a non-empty value.

import type { ValidationRule, ValidationContext } from '../validation-rule.js'
import { BaseRule } from '../rule-helpers.js'

export class SpeakerRule extends BaseRule implements ValidationRule {
  readonly id = 'speaker'
  readonly category = 'kind' as const
  readonly description = 'Speaker annotations target a text range and have a speaker name'

  check(ctx: ValidationContext) {
    const issues = []
    for (const section of ctx.doc.sections) {
      for (const entry of section.entries) {
        if (entry.kind !== 'speaker') continue
        if (entry.target.type === 'title' || entry.target.type === 'full') {
          issues.push(this.error(ctx, undefined,
            'speaker annotation must target a text range (marker, verse, or text-quote), not title/full'))
        }
        if (!entry.value) {
          issues.push(this.error(ctx, undefined, 'speaker annotation requires a speaker name'))
        }
      }
    }
    return issues
  }
}

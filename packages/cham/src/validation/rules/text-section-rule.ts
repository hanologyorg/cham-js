// Rule: text-section
// Category: structure
// Validates text section headers (### LEVEL[:LABEL]) and their block ranges.

import type { ValidationRule, ValidationContext } from '../validation-rule.js'
import { BaseRule } from '../rule-helpers.js'

export class TextSectionRule extends BaseRule implements ValidationRule {
  readonly id = 'text-section'
  readonly category = 'structure' as const
  readonly description = 'Text section headers and block ranges are consistent'

  check(ctx: ValidationContext) {
    const sections = ctx.doc.textSections
    if (!sections || sections.length === 0) return []
    const doc = ctx.doc
    const issues = []

    for (let i = 0; i < sections.length; i++) {
      const s = sections[i]
      if (!s.level) {
        issues.push(this.warning(ctx, undefined, `Text section ${i + 1} has no level name`))
      }
      if (s.startBlock < 0 || s.endBlock < 0) {
        issues.push(this.warning(ctx, undefined, `Text section "${s.level}" has invalid block range`))
      }
      if (s.endBlock < s.startBlock) {
        issues.push(this.warning(ctx, undefined, `Text section "${s.level}": endBlock (${s.endBlock}) < startBlock (${s.startBlock})`))
      }
      if (i > 0 && s.index !== sections[i - 1].index + 1) {
        issues.push(this.warning(ctx, undefined, `Text section indices not sequential: ${sections[i - 1].index} → ${s.index}`))
      }
      for (let bi = s.startBlock; bi < s.endBlock && bi < doc.textBlocks.length; bi++) {
        if (doc.textBlocks[bi].textSectionIndex !== i) {
          issues.push(this.warning(ctx, undefined, `Text block ${bi} in section "${s.level}" has wrong textSectionIndex`))
        }
      }
    }
    return issues
  }
}

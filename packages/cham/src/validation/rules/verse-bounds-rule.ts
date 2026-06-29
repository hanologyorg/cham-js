// Rule: verse-bounds
// Category: target
// Validates that @verse:N:C-E and @v:N targets reference valid block indices and offsets.

import type { ValidationRule, ValidationContext } from '../validation-rule.js'
import type { ValidationIssue } from '../../types.js'
import { BaseRule } from '../rule-helpers.js'

export class VerseBoundsRule extends BaseRule implements ValidationRule {
  readonly id = 'verse-bounds'
  readonly category = 'target' as const
  readonly description = '@verse and @v targets reference valid block indices and offsets'

  check(ctx: ValidationContext) {
    const doc = ctx.doc
    const issues: ValidationIssue[] = []
    for (const section of doc.sections) {
      for (const entry of section.entries) {
        if (entry.target.type === 'verse') {
          const { line, char, end } = entry.target
          if (line < 0 || line >= doc.textBlocks.length) {
            issues.push(this.error(ctx, undefined,
              `Verse/position target references non-existent text block ${line} (max ${doc.textBlocks.length - 1})`))
            continue
          }
          const block = doc.textBlocks[line]
          if (char < 0 || char >= block.text.length) {
            issues.push(this.error(ctx, undefined,
              `Verse/position target char offset ${char} out of range in block ${line} (length ${block.text.length})`))
            continue
          }
          if (end !== undefined && end > block.text.length) {
            issues.push(this.warning(ctx, undefined,
              `Verse/position target end offset ${end} exceeds block ${line} length ${block.text.length}`))
          }
        } else if (entry.target.type === 'verse-all') {
          const { line } = entry.target
          if (line < 0 || line >= doc.textBlocks.length) {
            issues.push(this.error(ctx, undefined,
              `@v:${line} target references non-existent text block ${line} (max ${doc.textBlocks.length - 1})`))
          }
        }
      }
    }
    return issues
  }
}

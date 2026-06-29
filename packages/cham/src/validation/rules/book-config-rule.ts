// Rule: book-config
// Category: config
// Validates book.yaml structure: required fields, layer definitions, volumes, etc.

import type { ValidationRule, ValidationContext } from '../validation-rule.js'
import type { ValidationIssue } from '../../types.js'
import { BaseRule } from '../rule-helpers.js'
import { VALID_NATURES } from '../../types.js'

export class BookConfigRule extends BaseRule implements ValidationRule {
  readonly id = 'book-config'
  readonly category = 'config' as const
  readonly description = 'Validates book.yaml structure'

  check(ctx: ValidationContext) {
    const { bookConfig } = ctx
    if (!bookConfig) return []
    const issues: ValidationIssue[] = []

    if (!bookConfig.id) issues.push(this.warning(ctx, undefined, 'Missing book id'))
    if (!bookConfig.title) issues.push(this.warning(ctx, undefined, 'Missing book title'))
    if (!bookConfig.genre) issues.push(this.info(ctx, undefined, 'No genre specified'))

    if (bookConfig.layers) {
      for (const layer of bookConfig.layers) {
        if (!layer.id) issues.push(this.error(ctx, undefined, 'Layer missing id'))
        if (!layer.label) issues.push(this.warning(ctx, undefined, `Layer "${layer.id}" missing label`))
        if (!layer.contributor) issues.push(this.warning(ctx, undefined, `Layer "${layer.id}" missing contributor`))
        if (layer.nature && !VALID_NATURES.has(layer.nature)) {
          issues.push(this.error(ctx, undefined, `Layer "${layer.id}" has unknown nature: "${layer.nature}"`))
        }
      }
    }

    if (bookConfig.contributors) {
      for (const c of bookConfig.contributors) {
        if (!c.ref) issues.push(this.error(ctx, undefined, 'Contributor missing ref'))
        if (!c.role) issues.push(this.warning(ctx, undefined, `Contributor "${c.ref}" missing role`))
      }
    }

    if (bookConfig.groups) {
      for (const group of bookConfig.groups) {
        if (!group.id) issues.push(this.error(ctx, undefined, 'Group missing id'))
        if (!group.label) issues.push(this.warning(ctx, undefined, `Group "${group.id}" missing label`))
      }
    }

    return issues
  }
}

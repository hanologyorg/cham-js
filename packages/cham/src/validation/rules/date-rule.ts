// Rule: date-consistency
// Category: quality
// Validates that era/year/iso dates are consistent and sexagenary is valid.

import type { ValidationRule, ValidationContext } from '../validation-rule.js'
import type { PrimaryMeta } from '../../types.js'
import { BaseRule, isPrimary } from '../rule-helpers.js'
import { resolveEraToDate } from '../../date-utils.js'

export class DateConsistencyRule extends BaseRule implements ValidationRule {
  readonly id = 'date-consistency'
  readonly category = 'quality' as const
  readonly description = 'Era/year matches ISO date; sexagenary is valid'

  check(ctx: ValidationContext) {
    const { doc, registries } = ctx
    if (!isPrimary(doc) || !registries) return []
    const pm = doc.meta as PrimaryMeta
    if (!pm.date) return []
    const issues = []

    const { era, era_year, iso, sexagenary } = pm.date
    if (era && era_year && iso !== undefined) {
      const resolved = resolveEraToDate(era, era_year, registries.eras)
      if (resolved !== undefined && resolved !== iso) {
        issues.push(this.warning(ctx, undefined,
          `Date inconsistency: ${era} year ${era_year} → ISO ${resolved}, but frontmatter says ${iso}`))
      }
    }
    if (sexagenary) {
      const valid = registries.sexagenary.some(s => s.label === sexagenary)
      if (!valid) {
        issues.push(this.warning(ctx, undefined, `Invalid sexagenary: "${sexagenary}"`))
      }
    }
    return issues
  }
}

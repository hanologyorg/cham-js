// Rule: kind-params
// Category: kind
// Validates that annotations have all required params for their kind
// (e.g., fanqie requires upper and lower).

import type { ValidationRule, ValidationContext } from '../validation-rule.js'
import type { ValidationIssue } from '../../types.js'
import { BaseRule } from '../rule-helpers.js'
import { AnnotationKindRegistry } from '../../model.js'

export class KindParamsRule extends BaseRule implements ValidationRule {
  readonly id = 'kind-params'
  readonly category = 'kind' as const
  readonly description = 'Required params present per annotation kind'

  check(ctx: ValidationContext) {
    const registry = ctx.kindRegistry ?? AnnotationKindRegistry.DEFAULT
    const issues: ValidationIssue[] = []
    for (const section of ctx.doc.sections) {
      for (const entry of section.entries) {
        for (const req of registry.requiredParams(entry.kind)) {
          if (!(req in entry.params)) {
            issues.push(this.error(ctx, undefined,
              `Annotation kind "${entry.kind}" missing required param: ${req}`))
          }
        }
      }
    }
    return issues
  }
}

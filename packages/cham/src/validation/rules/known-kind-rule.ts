// Rule: known-kind
// Category: kind
// Warns on annotation kinds not in the registry (likely typos or missing registrations).

import type { ValidationRule, ValidationContext } from '../validation-rule.js'
import type { ValidationIssue } from '../../types.js'
import { BaseRule } from '../rule-helpers.js'
import { AnnotationKindRegistry } from '../../model/annotation-kind.js'

export class KnownKindRule extends BaseRule implements ValidationRule {
  readonly id = 'known-kind'
  readonly category = 'kind' as const
  readonly description = 'Warns on unknown annotation kinds'

  check(ctx: ValidationContext) {
    const registry = ctx.kindRegistry ?? AnnotationKindRegistry.DEFAULT
    const issues: ValidationIssue[] = []
    for (const section of ctx.doc.sections) {
      for (const entry of section.entries) {
        if (!registry.has(entry.kind) && !entry.kind.includes(':')) {
          issues.push(this.warning(ctx, undefined, `Unknown annotation kind: "${entry.kind}"`))
        }
      }
    }
    return issues
  }
}

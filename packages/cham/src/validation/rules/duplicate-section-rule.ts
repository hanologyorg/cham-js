// Rule: duplicate-section
// Category: structure
// Validates that secondary files (not declared as book.yaml layers) don't
// duplicate section names from the primary file.

import type { ValidationRule, ValidationContext } from '../validation-rule.js'
import type { ValidationIssue } from '../../types.js'
import { BaseRule, isSecondary } from '../rule-helpers.js'

export class DuplicateSectionRule extends BaseRule implements ValidationRule {
  readonly id = 'duplicate-section'
  readonly category = 'structure' as const
  readonly description = 'Secondary files (non-layer) do not duplicate primary section names'

  check(ctx: ValidationContext) {
    const { doc, primaryDoc, bookConfig, filePath } = ctx
    if (!isSecondary(doc) || !primaryDoc) return []

    // Determine this file's layer ID from the filename
    const fileName = filePath.split('/').pop() || ''
    const layerId = fileName.replace(/\.cham\.md$/, '')
    const layerIds = new Set((bookConfig?.layers || []).map(l => l.id))

    // If this file IS a declared layer, duplicate section names are allowed
    // (e.g., both primary and layer may have "注釋" sections).
    if (layerIds.has(layerId)) return []

    const issues: ValidationIssue[] = []
    const primarySectionNames = new Set(primaryDoc.sections.map(s => s.name))
    for (const section of doc.sections) {
      if (primarySectionNames.has(section.name)) {
        issues.push(this.error(ctx, undefined,
          `Duplicate section name "${section.name}" — already defined in primary file`))
      }
    }
    return issues
  }
}

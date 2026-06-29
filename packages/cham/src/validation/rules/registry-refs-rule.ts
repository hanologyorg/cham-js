// Rule: registry-refs
// Category: registry
// Validates that author/place/event/allusion/see-also refs point to existing registry entries.

import type { ValidationRule, ValidationContext } from '../validation-rule.js'
import type { ValidationIssue } from '../../types.js'
import { existsSync, readdirSync } from 'fs'
import { join } from 'path'
import { BaseRule } from '../rule-helpers.js'

export class RegistryRefsRule extends BaseRule implements ValidationRule {
  readonly id = 'registry-refs'
  readonly category = 'registry' as const
  readonly description = 'Refs point to existing registry entries'

  check(ctx: ValidationContext) {
    const { doc, registries, filePath } = ctx
    if (!registries) return []
    const issues: ValidationIssue[] = []

    for (const section of doc.sections) {
      for (const entry of section.entries) {
        const ref = entry.params.ref
        if (!ref) {
          // Allusion source validation
          const source = entry.params.source
          if (source && entry.kind === 'allusion' && registries.sources && !(source in registries.sources)) {
            const match = Object.entries(registries.sources).find(
              ([, rec]) => rec.names.includes(source),
            )
            if (match) {
              issues.push(this.warning(ctx, undefined, `Allusion source "${source}" is an alternate name — use registry key "${match[0]}"`))
            } else {
              issues.push(this.warning(ctx, undefined, `Allusion source "${source}" not found in sources registry`))
            }
          }
          if (entry.kind === 'person') {
            issues.push(this.warning(ctx, undefined, `Person annotation lacks ref: — link to authors registry`))
          }
          if (entry.kind === 'place') {
            issues.push(this.warning(ctx, undefined, `Place annotation lacks ref: — link to places registry`))
          }
          if (entry.kind === 'event') {
            issues.push(this.warning(ctx, undefined, `Event annotation lacks ref: — link to events registry`))
          }
          continue
        }
        if (entry.kind === 'person' && registries.authors && !(ref in registries.authors)) {
          issues.push(this.warning(ctx, undefined, `Author ref "${ref}" not found in authors registry`))
        }
        if (entry.kind === 'place' && registries.places && !(ref in registries.places)) {
          issues.push(this.warning(ctx, undefined, `Place ref "${ref}" not found in places registry`))
        }
        if (entry.kind === 'event' && registries.events && !(ref in registries.events)) {
          issues.push(this.warning(ctx, undefined, `Event ref "${ref}" not found in events registry`))
        }
        if (entry.kind === 'see-also') {
          issues.push(...this.checkSeeAlsoRef(ctx, ref, filePath))
        }
      }
    }
    return issues
  }

  private checkSeeAlsoRef(ctx: ValidationContext, ref: string, filePath: string): ValidationIssue[] {
    const issues: ValidationIssue[] = []
    const parts = ref.split('/')
    if (parts.length < 2) {
      issues.push(this.warning(ctx, undefined, `see-also ref "${ref}" should be in collection/piece format`))
      return issues
    }
    const [collectionId, pieceId] = parts
    const contentDir = join(filePath, '..', '..', '..')
    const collectionDir = join(contentDir, collectionId)
    if (!existsSync(collectionDir)) {
      issues.push(this.warning(ctx, undefined, `see-also ref collection "${collectionId}" not found`))
      return issues
    }
    const pieceDirs = readdirSync(collectionDir, { withFileTypes: true })
      .filter(d => d.isDirectory() && d.name.match(/^\d+_/) && d.name.split('_')[0] === pieceId)
    if (pieceDirs.length === 0) {
      issues.push(this.warning(ctx, undefined, `see-also ref piece "${pieceId}" not found in collection "${collectionId}"`))
    }
    return issues
  }
}

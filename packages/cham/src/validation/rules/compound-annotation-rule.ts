// Rule: compound-annotation
// Category: quality
// Detects compound annotations that should be split into separate entries
// (full-width space, ○按, embedded zhiyin/fanqie/tone patterns).

import type { ValidationRule, ValidationContext } from '../validation-rule.js'
import type { ValidationIssue } from '../../types.js'
import { BaseRule } from '../rule-helpers.js'

export class CompoundAnnotationRule extends BaseRule implements ValidationRule {
  readonly id = 'compound-annotation'
  readonly category = 'quality' as const
  readonly description = 'Detects compound annotations needing split'

  check(ctx: ValidationContext) {
    const issues: ValidationIssue[] = []
    for (const section of ctx.doc.sections) {
      for (const entry of section.entries) {
        if (entry.kind !== 'meaning' && entry.kind !== 'commentary') continue
        issues.push(...this.checkValue(ctx, entry.value))
      }
    }
    return issues
  }

  private checkValue(ctx: ValidationContext, v: string): ValidationIssue[] {
    const issues: ValidationIssue[] = []
    if (v.includes('　')) {
      issues.push(this.warning(ctx, undefined,
        `Annotation contains full-width space (U+3000) — consider splitting into separate entries`))
    }
    if (v.includes('○按')) {
      issues.push(this.warning(ctx, undefined,
        `Annotation contains ○按 boundary — consider splitting into commentary + kaozheng entries`))
    }
    if (v.length <= 20) {
      const isNonZhiyin = v.includes('音義') || v.includes('音同') || v.includes('詳音')
        || v.includes('五音') || v.includes('八音') || v.includes('知音')
        || v.includes('觀音') || v.includes('注音') || v.includes('聲音')
      if (!isNonZhiyin) {
        const zhiyinPatterns = [
          /^音[一-鿿]{1,4}$/,
          /^[一-鿿]{1,2}音[一-鿿]{1,2}$/,
          /^[^，。；：\n]{1,6}，音[一-鿿]{1,4}$/,
        ]
        if (zhiyinPatterns.some(p => p.test(v))) {
          issues.push(this.warning(ctx, undefined,
            `Compound annotation: zhiyin pattern "${v.substring(0, 30)}" — extract as zhiyin entry`))
        }
      }
    }
    if (v.match(/\S\s\S\s切/)) {
      issues.push(this.warning(ctx, undefined,
        `Compound annotation: fanqie pattern "${v.substring(0, 30)}" — extract as fanqie entry`))
    }
    const tonePatterns = [
      /^[^，。；：\n]{1,8}[上去平入]聲$/,
      /^[^，。；：\n]{1,8}，[上去平入]聲$/,
      /^第[一二三四]聲?$/,
    ]
    if (tonePatterns.some(p => p.test(v))) {
      issues.push(this.warning(ctx, undefined,
        `Compound annotation: tone pattern "${v.substring(0, 30)}" — extract as tone entry`))
    }
    return issues
  }
}

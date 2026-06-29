// Rule: pinyin-ipa
// Category: quality
// Warns on IPA characters (ɑ U+0251, ɡ U+0261) in the raw source file,
// which should be standard Latin a/g.

import type { ValidationRule, ValidationContext } from '../validation-rule.js'
import { readFileSync } from 'fs'
import { BaseRule } from '../rule-helpers.js'

const IPA_CHARS: ReadonlyArray<[string, string, string]> = [
  ['ɑ', 'a', 'U+0251'],
  ['ɡ', 'g', 'U+0261'],
]

export class PinyinIpaRule extends BaseRule implements ValidationRule {
  readonly id = 'pinyin-ipa'
  readonly category = 'quality' as const
  readonly description = 'Warns on IPA characters that should be standard Latin'

  check(ctx: ValidationContext) {
    const issues = []
    const src = readFileSync(ctx.filePath, 'utf-8')
    for (const [bad, good, code] of IPA_CHARS) {
      if (src.includes(bad)) {
        issues.push(this.warning(ctx, undefined,
          `IPA character ${code} (${bad}) found — use standard Latin ${good} instead`))
      }
    }
    return issues
  }
}

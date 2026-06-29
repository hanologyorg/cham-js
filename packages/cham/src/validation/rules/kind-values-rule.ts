// Rule: kind-values
// Category: kind
// Validates annotation value formats per kind
// (e.g., fanqie ends with 切/反, tone is a valid category).

import type { ValidationRule, ValidationContext } from '../validation-rule.js'
import type { ValidationIssue } from '../../types.js'
import { BaseRule } from '../rule-helpers.js'

const PRON_TYPES = new Set(['hom', 'jyut', 'pinyin', 'bopomofo'])
const PRON_LANGS = new Set(['yue', 'cmn'])
const VARIANT_ACTIONS = new Set(['emend', 'note', 'parallel'])
const TONE_VALUES = new Set(['上聲', '去聲', '平聲', '入聲', '如字'])
const IPA_LATIN_RE = /[ɑɡ]/u
const BPMF_SYMBOLS = /^[ㄅㄆㄇㄈㄉㄊㄋㄌㄍㄎㄏㄐㄑㄒㄓㄔㄕㄖㄗㄘㄙㄚㄛㄜㄝㄞㄟㄠㄡㄢㄣㄤㄥㄦㄧㄨㄩˉˊˇˋ˙ ]+$/u

export class KindValuesRule extends BaseRule implements ValidationRule {
  readonly id = 'kind-values'
  readonly category = 'kind' as const
  readonly description = 'Annotation value formats match their kind'

  check(ctx: ValidationContext) {
    const issues: ValidationIssue[] = []
    for (const section of ctx.doc.sections) {
      for (const entry of section.entries) {
        issues.push(...this.checkEntry(ctx, entry.kind, entry.value, entry.params))
      }
    }
    return issues
  }

  private checkEntry(
    ctx: ValidationContext,
    kind: string,
    value: string,
    params: Record<string, string>,
  ): ValidationIssue[] {
    const issues: ValidationIssue[] = []
    switch (kind) {
      case 'fanqie':
        if (value && !value.endsWith('切') && !value.endsWith('反')) {
          issues.push(this.error(ctx, undefined, `fanqie value must end with 切 or 反: "${value}"`))
        }
        break
      case 'tone':
        if (value && !TONE_VALUES.has(value)) {
          issues.push(this.error(ctx, undefined,
            `Invalid tone category: "${value}" — expected one of: ${[...TONE_VALUES].join(', ')}`))
        }
        break
      case 'pron':
        if (params.type && !PRON_TYPES.has(params.type)) {
          issues.push(this.error(ctx, undefined,
            `Invalid pron type: "${params.type}" — expected one of: ${[...PRON_TYPES].join(', ')}`))
        }
        if (params.lang && !PRON_LANGS.has(params.lang)) {
          issues.push(this.error(ctx, undefined,
            `Invalid pron lang: "${params.lang}" — expected one of: ${[...PRON_LANGS].join(', ')}`))
        }
        if (params.type === 'pinyin' && value && IPA_LATIN_RE.test(value)) {
          issues.push(this.error(ctx, undefined,
            `Pinyin value contains IPA characters (ɑ U+0251 or ɡ U+0261): "${value}" — use standard Latin a/g instead`))
        }
        if (params.type === 'bopomofo' && value && !BPMF_SYMBOLS.test(value)) {
          issues.push(this.error(ctx, undefined,
            `Bopomofo value contains non-BPMF characters: "${value}"`))
        }
        break
      case 'pinyin':
        if (value && IPA_LATIN_RE.test(value)) {
          issues.push(this.error(ctx, undefined,
            `Pinyin value contains IPA characters (ɑ U+0251 or ɡ U+0261): "${value}" — use standard Latin a/g instead`))
        }
        break
      case 'bpmf':
        if (value && !BPMF_SYMBOLS.test(value)) {
          issues.push(this.error(ctx, undefined,
            `Bopomofo value contains non-BPMF characters: "${value}"`))
        }
        break
      case 'variant':
        if (params.action && !VARIANT_ACTIONS.has(params.action)) {
          issues.push(this.error(ctx, undefined,
            `Invalid variant action: "${params.action}" — expected one of: ${[...VARIANT_ACTIONS].join(', ')}`))
        }
        break
    }
    return issues
  }
}

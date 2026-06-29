import { readFileSync, writeFileSync, existsSync } from 'fs'
import { walkFiles, allChamFiles } from './_walk.js'

/**
 * Normalizes IPA characters in pinyin annotation values:
 *   ɑ (U+0251) → a (U+0061)
 *   ɡ (U+0261) → g (U+0067)
 *
 * Only replaces within pinyin value brackets, not in general text.
 */

const IPA_ALPHA = 'ɑ'
const IPA_G = 'ɡ'
const IPA_REPLACEMENTS: ReadonlyArray<[string, string]> = [
  [IPA_ALPHA, 'a'],
  [IPA_G, 'g'],
]

/**
 * Counts IPA characters in a bracket value and produces the normalized form.
 * Returns `{ normalized, count }` where `count` is 0 if no change is needed.
 */
function normalizeBracket(bracketContent: string): { normalized: string; count: number } {
  let normalized = bracketContent
  let count = 0
  for (const [from, to] of IPA_REPLACEMENTS) {
    const matches = bracketContent.match(new RegExp(from, 'g'))
    if (matches) {
      count += matches.length
      normalized = normalized.replaceAll(from, to)
    }
  }
  return { normalized, count }
}

/**
 * Apply IPA normalization inside every `pron type:pinyin lang:... [...]`
 * annotation in `content`. Returns `{ result, fixed }` where `fixed` is the
 * total number of IPA characters replaced.
 *
 * Matches both `{...}` (marker) and `@...` (positional) target prefixes —
 * the bracket-value extraction is identical for both.
 */
function normalizeContent(content: string): { result: string; fixed: number } {
  let fixed = 0
  // The leading `\S+` captures the target token (e.g. `{1}` or `@verse:0:0`).
  const result = content.replace(
    /(\S+)\s+pron\s+type:pinyin\s+lang:\w+\s+\[([^\]]*)\]/g,
    (match, _target: string, bracketContent: string) => {
      const { normalized, count } = normalizeBracket(bracketContent)
      if (count === 0) return match
      fixed += count
      return match.replace(bracketContent, normalized)
    },
  )
  return { result, fixed }
}

function fixFile(filePath: string): number {
  const content = readFileSync(filePath, 'utf-8')
  const { result, fixed } = normalizeContent(content)
  if (fixed > 0) writeFileSync(filePath, result, 'utf-8')
  return fixed
}

export function normalizeIPA(contentDir: string): void {
  const files = walkFiles(contentDir, allChamFiles)
  let totalFixed = 0
  let filesFixed = 0
  for (const f of files) {
    const count = fixFile(f)
    if (count > 0) {
      filesFixed++
      totalFixed += count
      console.log(`  Fixed ${count} chars: ${f}`)
    }
  }
  console.log(`\nNormalized ${totalFixed} IPA chars in ${filesFixed} of ${files.length} files.`)
}

const contentDir = process.argv[2]
if (!contentDir || !existsSync(contentDir)) {
  console.error('Usage: npx tsx src/normalize-ipa.ts <content-dir>')
  process.exit(1)
}
normalizeIPA(contentDir)

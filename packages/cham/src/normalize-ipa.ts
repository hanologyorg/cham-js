import { readFileSync, writeFileSync, readdirSync, existsSync } from 'fs'
import { join } from 'path'

/**
 * Normalizes IPA characters in pinyin annotation values:
 *   ɑ (U+0251) → a (U+0061)
 *   ɡ (U+0261) → g (U+0067)
 *
 * Only replaces within pinyin value brackets, not in general text.
 */

const IPA_ALPHA = 'ɑ' // ɑ
const IPA_G = 'ɡ' // ɡ

function fixFile(filePath: string): number {
  const content = readFileSync(filePath, 'utf-8')
  let fixed = 0
  let result = content

  // Match pron annotations with type:pinyin and replace IPA chars in the bracket value
  result = result.replace(
    /\{[^}]*\}\s*pron\s+type:pinyin\s+lang:\w+\s+\[([^\]]*)\]/g,
    (match, bracketContent: string) => {
      const normalized = bracketContent
        .replaceAll(IPA_ALPHA, 'a')
        .replaceAll(IPA_G, 'g')
      if (normalized !== bracketContent) {
        const count =
          (bracketContent.match(new RegExp(IPA_ALPHA, 'g')) || []).length +
          (bracketContent.match(new RegExp(IPA_G, 'g')) || []).length
        fixed += count
        return match.replace(bracketContent, normalized)
      }
      return match
    },
  )

  // Also handle @-prefixed pron annotations
  result = result.replace(
    /@\S+\s+pron\s+type:pinyin\s+lang:\w+\s+\[([^\]]*)\]/g,
    (match, bracketContent: string) => {
      const normalized = bracketContent
        .replaceAll(IPA_ALPHA, 'a')
        .replaceAll(IPA_G, 'g')
      if (normalized !== bracketContent) {
        const count =
          (bracketContent.match(new RegExp(IPA_ALPHA, 'g')) || []).length +
          (bracketContent.match(new RegExp(IPA_G, 'g')) || []).length
        fixed += count
        return match.replace(bracketContent, normalized)
      }
      return match
    },
  )

  if (fixed > 0) {
    writeFileSync(filePath, result, 'utf-8')
  }
  return fixed
}

function walkDir(dir: string): string[] {
  const results: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name)
    if (entry.isDirectory()) {
      results.push(...walkDir(fullPath))
    } else if (entry.name.endsWith('.cham.md')) {
      results.push(fullPath)
    }
  }
  return results
}

export function normalizeIPA(contentDir: string): void {
  const files = walkDir(contentDir)
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

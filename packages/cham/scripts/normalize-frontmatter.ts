import { readFileSync, writeFileSync, existsSync } from 'fs'
import { walkFiles, bookYamlAndCham } from './_walk.js'

/**
 * Mechanical frontmatter normalization for CHAM files.
 * Fixes:
 *   1. Remove non-spec `type: secondary` field from subordinate files
 *   2. Change `role: commentator` to `role: annotator`
 *   3. Change `contributor: 四庫全書館臣` to `contributor: C010`
 *   4. Change `titleEn:` to `title-en:` in book.yaml
 */

function fixFile(filePath: string): boolean {
  let content = readFileSync(filePath, 'utf-8')
  let changed = false

  if (content.includes('type: secondary\n')) {
    content = content.replace('type: secondary\n', '')
    changed = true
  }

  if (content.includes('role: commentator')) {
    content = content.replaceAll('role: commentator', 'role: annotator')
    changed = true
  }

  if (content.includes('contributor: 四庫全書館臣')) {
    content = content.replaceAll('contributor: 四庫全書館臣', 'contributor: C010')
    changed = true
  }

  if (content.includes('titleEn:')) {
    content = content.replaceAll('titleEn:', 'title-en:')
    changed = true
  }

  if (changed) {
    writeFileSync(filePath, content, 'utf-8')
  }
  return changed
}

export function normalizeFrontmatter(contentDir: string): void {
  const files = walkFiles(contentDir, bookYamlAndCham)
  let fixed = 0
  for (const f of files) {
    if (fixFile(f)) {
      fixed++
      console.log(`  Fixed: ${f}`)
    }
  }
  console.log(`\nNormalized ${fixed} of ${files.length} files.`)
}

const contentDir = process.argv[2]
if (!contentDir || !existsSync(contentDir)) {
  console.error('Usage: npx tsx src/normalize-frontmatter.ts <content-dir>')
  process.exit(1)
}
normalizeFrontmatter(contentDir)

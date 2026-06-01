import { readFileSync, writeFileSync, readdirSync, existsSync } from 'fs'
import { join, dirname } from 'path'

/**
 * Reverts empty `## 注釋` sections from primary text files when a subordinate
 * file in the same directory also has `## 注釋`. This avoids duplicate section
 * name errors.
 */

function hasSubordinateWithSection(pieceDir: string): boolean {
  const files = readdirSync(pieceDir)
  for (const f of files) {
    if (!f.endsWith('.cham.md') || f === 'text.cham.md') continue
    const fp = join(pieceDir, f)
    const content = readFileSync(fp, 'utf-8')
    if (content.includes('## 注釋')) return true
  }
  return false
}

function hasEmptySection(content: string): boolean {
  // Match "## 注釋\n" at end of file with nothing after it
  return /\n\n## 注釋\n$/.test(content) || /\n## 注釋\n$/.test(content)
}

function fixFile(filePath: string): boolean {
  const content = readFileSync(filePath, 'utf-8')
  if (!hasEmptySection(content)) return false

  const pieceDir = dirname(filePath)
  if (!hasSubordinateWithSection(pieceDir)) return false

  // Remove the empty ## 注釋 section
  const result = content.replace(/\n\n## 注釋\n$/, '\n').replace(/\n## 注釋\n$/, '\n')
  writeFileSync(filePath, result, 'utf-8')
  return true
}

function walkDir(dir: string): string[] {
  const results: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name)
    if (entry.isDirectory()) {
      results.push(...walkDir(fullPath))
    } else if (entry.name === 'text.cham.md') {
      results.push(fullPath)
    }
  }
  return results
}

export function revertDuplicateSections(contentDir: string): void {
  const files = walkDir(contentDir)
  let fixed = 0
  for (const f of files) {
    if (fixFile(f)) {
      fixed++
      console.log(`  Reverted: ${f}`)
    }
  }
  console.log(`\nReverted ${fixed} of ${files.length} files.`)
}

const contentDir = process.argv[2]
if (!contentDir || !existsSync(contentDir)) {
  console.error('Usage: npx tsx src/revert-duplicate-sections.ts <content-dir>')
  process.exit(1)
}
revertDuplicateSections(contentDir)

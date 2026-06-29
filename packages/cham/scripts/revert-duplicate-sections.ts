import { readFileSync, writeFileSync, readdirSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { walkFiles, primaryTextFiles } from './_walk.js'

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
  // Match an empty `## 注釋` section at end of file (with or without a blank line before it).
  return /\n## 注釋\n$/.test(content)
}

function fixFile(filePath: string): boolean {
  const content = readFileSync(filePath, 'utf-8')
  if (!hasEmptySection(content)) return false

  const pieceDir = dirname(filePath)
  if (!hasSubordinateWithSection(pieceDir)) return false

  // Remove the empty ## 注釋 section
  const result = content.replace(/\n## 注釋\n$/, '\n')
  writeFileSync(filePath, result, 'utf-8')
  return true
}

export function revertDuplicateSections(contentDir: string): void {
  const files = walkFiles(contentDir, primaryTextFiles)
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

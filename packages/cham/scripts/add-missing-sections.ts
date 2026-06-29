import { readFileSync, writeFileSync, existsSync } from 'fs'
import { walkFiles, primaryTextFiles } from './_walk.js'

/**
 * Adds missing `## 注釋` sections to text.cham.md files that have markers
 * but no annotation section. The empty section signals that annotations
 * are intentional (either empty or in subordinate files).
 */

function fixFile(filePath: string): boolean {
  const content = readFileSync(filePath, 'utf-8')
  if (content.includes('## 注釋')) return false

  // Only add if file has markers
  if (!/\{\d+\}/.test(content)) return false

  // Add ## 注釋 at the end, ensuring proper spacing
  const trimmed = content.trimEnd()
  const newContent = trimmed + '\n\n## 注釋\n'
  writeFileSync(filePath, newContent, 'utf-8')
  return true
}

export function addMissingSections(contentDir: string): void {
  const files = walkFiles(contentDir, primaryTextFiles)
  let fixed = 0
  for (const f of files) {
    if (fixFile(f)) {
      fixed++
      console.log(`  Added ## 注釋: ${f}`)
    }
  }
  console.log(`\nAdded section to ${fixed} of ${files.length} files.`)
}

const contentDir = process.argv[2]
if (!contentDir || !existsSync(contentDir)) {
  console.error('Usage: npx tsx src/add-missing-sections.ts <content-dir>')
  process.exit(1)
}
addMissingSections(contentDir)

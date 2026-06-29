// ─── Clean Primary Text Markers ─────────────────────────────────
// Strips {N}...{/N} markers from text.cham.md files in a book directory.
// Used after commentary migration to per-scholar @[quote] references.
//
// Usage:
//   npx tsx scripts/clean-text-markers.ts <book-dir> [--dry-run]

import { readdirSync, existsSync, readFileSync, writeFileSync } from 'fs'
import { join, basename, resolve } from 'path'
import { parse } from '../src/index.js'
import { cleanPrimaryTextMarkers } from './split-commentary-layers.js'

function main(): void {
  const args = process.argv.slice(2)
  if (args.length < 1) {
    console.error('Usage: clean-text-markers <book-dir> [--dry-run]')
    process.exit(1)
  }

  const bookDir = resolve(args[0])
  const dryRun = args.includes('--dry-run')

  const pieceDirs = readdirSync(bookDir, { withFileTypes: true })
    .filter(d => d.isDirectory() && existsSync(join(bookDir, d.name, 'text.cham.md')))
    .map(d => join(bookDir, d.name))
    .sort()

  let totalStripped = 0
  let cleanedCount = 0

  for (const pieceDir of pieceDirs) {
    const textPath = join(pieceDir, 'text.cham.md')
    const doc = parse(readFileSync(textPath, 'utf-8'))
    if (doc.markers.size === 0) continue

    const pieceName = basename(pieceDir)
    console.log(`  ${pieceName}: ${doc.markers.size} markers`)
    totalStripped += doc.markers.size

    if (!dryRun) {
      const cleaned = cleanPrimaryTextMarkers(doc)
      writeFileSync(textPath, cleaned, 'utf-8')
      cleanedCount++
    }
  }

  console.log(`\nSummary: stripped ${totalStripped} markers from ${cleanedCount} files`)
  if (dryRun) console.log('(dry run — no files written)')
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}

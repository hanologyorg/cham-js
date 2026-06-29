// ─── Batch Commentary Migration ────────────────────────────────
// Runs split-commentary-layers on every piece directory in a book.
//
// Safe migration:
//   1. Creates per-scholar .cham.md files (additive)
//   2. Archives original commentary.cham.md to archive/ subdir (preserved)
//   3. Optionally cleans text markers
//   4. Reports summary
//
// Usage:
//   npx tsx scripts/migrate-book-commentary.ts <book-dir> [--clean-text] [--dry-run]

import { readdirSync, existsSync, mkdirSync, renameSync, readFileSync, writeFileSync } from 'fs'
import { join, basename, resolve } from 'path'
import { parse } from '../src/index.js'
import {
  loadScholarMap, splitCommentaryByScholar,
  cleanPrimaryTextMarkers, type SplitOptions,
} from './split-commentary-layers.js'

function main(): void {
  const args = process.argv.slice(2)
  if (args.length < 1) {
    console.error('Usage: migrate-book-commentary <book-dir> [--clean-text] [--dry-run]')
    process.exit(1)
  }

  const bookDir = resolve(args[0])
  const cleanText = args.includes('--clean-text')
  const dryRun = args.includes('--dry-run')
  const options: SplitOptions = { dryRun, cleanText }

  const mapPath = join(bookDir, 'scholar-map.yaml')
  if (!existsSync(mapPath)) {
    console.error(`Error: no scholar-map.yaml found in ${bookDir}`)
    process.exit(1)
  }
  const map = loadScholarMap(mapPath)

  // Find all piece directories (those containing text.cham.md)
  const pieceDirs = readdirSync(bookDir, { withFileTypes: true })
    .filter(d => d.isDirectory() && existsSync(join(bookDir, d.name, 'text.cham.md')))
    .map(d => join(bookDir, d.name))
    .sort()

  if (pieceDirs.length === 0) {
    console.error(`No piece directories found in ${bookDir}`)
    process.exit(1)
  }

  console.log(`\nMigrating ${pieceDirs.length} pieces in ${basename(bookDir)}`)
  console.log(`Map: ${mapPath}`)
  console.log(`Options: dryRun=${!!dryRun}, cleanText=${cleanText}`)
  console.log('')

  let totalAnnotations = 0
  let totalUnmatched = 0
  const fileCounts: Record<string, number> = {}
  const archiveDir = join(bookDir, 'archive')
  let archivedCount = 0
  let cleanedCount = 0

  for (const pieceDir of pieceDirs) {
    const pieceName = basename(pieceDir)
    const textPath = join(pieceDir, 'text.cham.md')
    const commentaryPath = join(pieceDir, 'commentary.cham.md')

    if (!existsSync(commentaryPath)) {
      console.log(`  ${pieceName}: SKIP (no commentary.cham.md)`)
      continue
    }

    const primaryDoc = parse(readFileSync(textPath, 'utf-8'))
    const commentaryDoc = parse(readFileSync(commentaryPath, 'utf-8'))
    const result = splitCommentaryByScholar(commentaryDoc, primaryDoc, map, options)

    const pieceAnnotations = Object.values(result.counts).reduce((a, b) => a + b, 0)
    totalAnnotations += pieceAnnotations
    totalUnmatched += result.unmatched.length

    const summary = Object.entries(result.counts)
      .map(([k, n]) => `${k}:${n}`)
      .join(' ')
    console.log(`  ${pieceName}: ${pieceAnnotations} anns (${summary})${result.unmatched.length ? ` + ${result.unmatched.length} unmatched` : ''}`)

    for (const file of Object.keys(result.outputs)) {
      fileCounts[file] = (fileCounts[file] || 0) + result.counts[Object.keys(map.scholars).find(k => map.scholars[k].file === file) || file] || result.outputs[file].length
    }

    if (dryRun) continue

    // Skip archiving if no annotations were routed (e.g., 提要 chapter
    // with different conventions). Leave the original in place.
    if (pieceAnnotations === 0) {
      console.log(`    (skipping archive — no annotations routed)`)
      continue
    }

    // Write per-scholar files
    for (const [file, content] of Object.entries(result.outputs)) {
      const outPath = join(pieceDir, `${file}.cham.md`)
      writeFileSync(outPath, content, 'utf-8')
    }

    // Archive the original commentary.cham.md
    if (!existsSync(archiveDir)) mkdirSync(archiveDir, { recursive: true })
    const archivePath = join(archiveDir, `${pieceName}.commentary.cham.md`)
    renameSync(commentaryPath, archivePath)
    archivedCount++

    // Clean primary text markers if requested
    if (cleanText && primaryDoc.markers.size > 0) {
      const cleaned = cleanPrimaryTextMarkers(primaryDoc)
      writeFileSync(textPath, cleaned, 'utf-8')
      cleanedCount++
    }
  }

  console.log('')
  console.log(`Summary:`)
  console.log(`  Total annotations routed: ${totalAnnotations}`)
  if (totalUnmatched > 0) {
    console.log(`  UNMATCHED annotations: ${totalUnmatched}`)
    if (!map.default) {
      console.log(`  ⚠ Add "default: <file>" to scholar-map.yaml to route unmatched annotations.`)
    }
  }
  console.log(`  Per-scholar file counts:`)
  for (const [file, count] of Object.entries(fileCounts)) {
    console.log(`    ${file}.cham.md: ${count} total annotations`)
  }
  if (!dryRun) {
    console.log(`  Archived original commentary files: ${archivedCount}`)
    if (cleanText) console.log(`  Cleaned primary text files: ${cleanedCount}`)
  } else {
    console.log(`\n(dry run — no files written)`)
  }

  console.log('')
  console.log(`Next steps:`)
  console.log(`  1. Update ${bookDir}/book.yaml layers to use the new per-scholar IDs`)
  console.log(`  2. Verify with: cham-validate ${bookDir}`)
  console.log(`  3. Archive originals are in ${archiveDir}/`)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}

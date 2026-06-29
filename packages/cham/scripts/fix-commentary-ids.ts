import { readFileSync, writeFileSync, readdirSync, existsSync } from 'fs'
import { join, resolve } from 'path'

/**
 * Fixes commentary files to use original marker IDs from text files.
 *
 * After the buggy renumber-markers + repair-markers sequence:
 * - Text files have original marker IDs (restored by repair)
 * - Commentary files have sequential IDs (from renumber)
 *
 * This tool builds a mapping from sequential position → original ID
 * using the text file, then applies it to commentary files.
 *
 * Usage:
 *   npx tsx src/fix-commentary-ids.ts <content-dir> [--dry-run]
 */

function extractMarkerIdsInOrder(textPath: string): number[] {
  const content = readFileSync(textPath, 'utf-8')
  const markerRe = /\{(\d+)\}/g
  const ids: number[] = []
  const seen = new Set<number>()
  let m: RegExpExecArray | null
  while ((m = markerRe.exec(content)) !== null) {
    const id = parseInt(m[1], 10)
    if (!seen.has(id)) {
      ids.push(id)
      seen.add(id)
    }
  }
  return ids
}

function applyIdMapping(filePath: string, mapping: Map<number, number>, dryRun: boolean): number {
  const content = readFileSync(filePath, 'utf-8')
  const markerRe = /\{\/?(\d+)\}/g
  let fixed = 0

  const refs: { start: number; end: number; id: number }[] = []
  let m: RegExpExecArray | null
  while ((m = markerRe.exec(content)) !== null) {
    const id = parseInt(m[1], 10)
    if (mapping.has(id)) {
      refs.push({ start: m.index, end: m.index + m[0].length, id })
    }
  }

  if (refs.length === 0) return 0

  // Apply from end to preserve offsets
  let result = content
  for (let i = refs.length - 1; i >= 0; i--) {
    const ref = refs[i]
    const newId = mapping.get(ref.id)!
    if (newId !== ref.id) {
      const isClose = result[ref.start + 1] === '/'
      const replacement = isClose ? `{/${newId}}` : `{${newId}}`
      result = result.slice(0, ref.start) + replacement + result.slice(ref.end)
      fixed++
    }
  }

  if (fixed > 0 && !dryRun) {
    writeFileSync(filePath, result, 'utf-8')
  }

  return fixed
}

function main(): void {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const contentDir = args.find(a => !a.startsWith('--'))

  if (!contentDir) {
    console.error('Usage: fix-commentary-ids <content-dir> [--dry-run]')
    process.exit(1)
  }

  const resolved = resolve(contentDir)
  console.log(`Fixing commentary IDs: ${resolved}`)
  if (dryRun) console.log('(dry run)')

  let totalFixed = 0
  let piecesFixed = 0

  for (const pieceDir of readdirSync(resolved).sort()) {
    const textPath = join(resolved, pieceDir, 'text.cham.md')
    if (!existsSync(textPath)) continue

    // Get original marker IDs in order from text file
    const originalIds = extractMarkerIdsInOrder(textPath)
    if (originalIds.length === 0) continue

    // Build mapping: sequential position (1-based) → original ID
    const mapping = new Map<number, number>()
    for (let i = 0; i < originalIds.length; i++) {
      mapping.set(i + 1, originalIds[i])
    }

    // Apply mapping to all commentary/subordinate files
    let pieceFixed = 0
    for (const f of readdirSync(join(resolved, pieceDir)).sort()) {
      if (!f.endsWith('.cham.md') || f === 'text.cham.md') continue
      const filePath = join(resolved, pieceDir, f)
      const fixed = applyIdMapping(filePath, mapping, dryRun)
      pieceFixed += fixed
    }

    if (pieceFixed > 0) {
      console.log(`  ${pieceDir}: ${pieceFixed} IDs fixed (map: ${mapping.size} entries)`)
      totalFixed += pieceFixed
      piecesFixed++
    }
  }

  console.log(`\nFixed ${totalFixed} IDs in ${piecesFixed} pieces`)
}

main()

import { existsSync, readFileSync, writeFileSync, readdirSync } from 'fs'
import { join, basename, resolve } from 'path'
import { parse } from '../src/parser.js'

/**
 * Renumber markers in a CHAM collection to be sequential.
 * Optionally removes orphan markers (markers with no annotation entry).
 *
 * Usage:
 *   npx tsx src/renumber-markers.ts <content-dir> [--remove-orphans] [--dry-run]
 */

interface RenumberResult {
  file: string
  orphanCount: number
  renumberedCount: number
  mapping: Map<number, number>
}

function collectAnnotatedMarkers(pieceDir: string): Set<number> {
  const annotated = new Set<number>()
  const files = readdirSync(pieceDir)

  for (const f of files) {
    if (f.endsWith('.cham.md') && f !== 'text.cham.md') {
      const doc = parse(readFileSync(join(pieceDir, f), 'utf-8'))
      for (const section of doc.sections) {
        for (const entry of section.entries) {
          if (entry.target.type === 'marker') {
            annotated.add(entry.target.markerId)
          }
        }
      }
    }
  }

  return annotated
}

function collectTextMarkers(textPath: string): Set<number> {
  const content = readFileSync(textPath, 'utf-8')
  const markers = new Set<number>()
  let m: RegExpExecArray | null

  const openRe = /\{(\d+)\}/g
  while ((m = openRe.exec(content)) !== null) {
    markers.add(parseInt(m[1], 10))
  }

  const closeRe = /\{\/(\d+)\}/g
  while ((m = closeRe.exec(content)) !== null) {
    markers.add(parseInt(m[1], 10))
  }

  return markers
}

function applyMapping(content: string, mapping: Map<number, number>): string {
  // Match both open markers {N} and close markers {/N}
  const markerRe = /\{\/?(\d+)\}/g
  const allRefs: { start: number; end: number; id: number; isClose: boolean }[] = []

  let m: RegExpExecArray | null
  while ((m = markerRe.exec(content)) !== null) {
    const isClose = m[0].includes('/')
    allRefs.push({
      start: m.index,
      end: m.index + m[0].length,
      id: parseInt(m[1], 10),
      isClose,
    })
  }

  const parts: string[] = []
  let lastIdx = 0

  for (const ref of allRefs) {
    parts.push(content.slice(lastIdx, ref.start))
    const newId = mapping.get(ref.id)
    if (newId !== undefined) {
      parts.push(ref.isClose ? `{/${newId}}` : `{${newId}}`)
    } else {
      // Keep original if not in mapping
      parts.push(content.slice(ref.start, ref.end))
    }
    lastIdx = ref.end
  }
  parts.push(content.slice(lastIdx))

  return parts.join('')
}

function renumberPiece(
  pieceDir: string,
  removeOrphans: boolean,
  dryRun: boolean,
): RenumberResult | null {
  const textPath = join(pieceDir, 'text.cham.md')
  if (!existsSync(textPath)) return null

  const textMarkers = collectTextMarkers(textPath)
  const annotatedMarkers = collectAnnotatedMarkers(pieceDir)

  const orphans = new Set([...textMarkers].filter(id => !annotatedMarkers.has(id)))
  const orphanCount = orphans.size

  // Build the surviving marker set
  const surviving = [...textMarkers].filter(id => !orphans.has(id)).sort((a, b) => a - b)

  if (surviving.length === 0) return null

  // Build mapping: old id → new sequential id
  const mapping = new Map<number, number>()
  let needsRenumbering = false
  for (let i = 0; i < surviving.length; i++) {
    const oldId = surviving[i]
    const newId = i + 1
    mapping.set(oldId, newId)
    if (oldId !== newId) needsRenumbering = true
  }

  // Also map orphan markers to themselves (they'll be removed, not renumbered)
  // Actually, if removeOrphans, we need to remove them from text
  // If not removeOrphans, they keep their original IDs (no mapping = no change)

  if (!needsRenumbering && orphanCount === 0) return null
  if (!removeOrphans && !needsRenumbering) return null

  const result: RenumberResult = {
    file: basename(pieceDir),
    orphanCount,
    renumberedCount: [...mapping].filter(([old, nw]) => old !== nw).length,
    mapping,
  }

  if (dryRun) {
    if (orphanCount > 0) {
      const orphanList = [...orphans].sort((a, b) => a - b).join(', ')
      console.log(`  ${basename(pieceDir)}: ${orphanCount} orphans (${orphanList})`)
    }
    if (result.renumberedCount > 0) {
      console.log(`  ${basename(pieceDir)}: ${result.renumberedCount} markers to renumber`)
    }
    return result
  }

  // Process text.cham.md
  let textContent = readFileSync(textPath, 'utf-8')

  if (removeOrphans && orphans.size > 0) {
    // Remove orphan marker pairs from text
    for (const orphanId of orphans) {
      // Remove {N}text{/N} pattern — but keep the wrapped text
      const openRe = new RegExp(`\\{${orphanId}\\}`, 'g')
      const closeRe = new RegExp(`\\{\\/${orphanId}\\}`, 'g')
      textContent = textContent.replace(openRe, '').replace(closeRe, '')
    }
  }

  // Apply renumbering
  if (needsRenumbering) {
    textContent = applyMapping(textContent, mapping)
  }

  writeFileSync(textPath, textContent, 'utf-8')

  // Process all commentary/subordinate files
  const files = readdirSync(pieceDir)
  for (const f of files) {
    if (!f.endsWith('.cham.md') || f === 'text.cham.md') continue
    const filePath = join(pieceDir, f)
    let content = readFileSync(filePath, 'utf-8')

    // Remove annotation entries that reference orphan markers
    if (removeOrphans && orphans.size > 0) {
      const lines = content.split('\n')
      const newLines: string[] = []
      let skipEntry = false

      for (const line of lines) {
        const markerMatch = line.match(/^\{(\d+)\}/)
        if (markerMatch) {
          const id = parseInt(markerMatch[1], 10)
          skipEntry = orphans.has(id)
        }

        if (!skipEntry) {
          newLines.push(line)
        }

        // Reset skip on blank lines (entry boundary)
        if (line.trim() === '') {
          skipEntry = false
        }
      }
      content = newLines.join('\n')
    }

    // Apply renumbering to remaining entries
    if (needsRenumbering) {
      content = applyMapping(content, mapping)
    }

    writeFileSync(filePath, content, 'utf-8')
  }

  return result
}

// ─── CLI ─────────────────────────────────────────────────────────

function main(): void {
  const args = process.argv.slice(2)
  const removeOrphans = args.includes('--remove-orphans')
  const dryRun = args.includes('--dry-run')
  const contentDir = args.find(a => !a.startsWith('--'))

  if (!contentDir) {
    console.error('Usage: renumber-markers <content-dir> [--remove-orphans] [--dry-run]')
    process.exit(1)
  }

  const resolved = resolve(contentDir)
  console.log(`Processing: ${resolved}`)
  if (dryRun) console.log('(dry run — no changes will be written)')
  if (removeOrphans) console.log('Removing orphan markers')

  let totalOrphans = 0
  let totalRenumbered = 0
  let piecesProcessed = 0

  for (const pieceDir of readdirSync(resolved).sort()) {
    const full = join(resolved, pieceDir)
    if (!existsSync(join(full, 'text.cham.md'))) continue

    const result = renumberPiece(full, removeOrphans, dryRun)
    if (result) {
      totalOrphans += result.orphanCount
      totalRenumbered += result.renumberedCount
      piecesProcessed++
    }
  }

  console.log(`\nProcessed ${piecesProcessed} pieces: ${totalOrphans} orphans, ${totalRenumbered} renumbered markers`)
}

main()

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'fs'
import { join, resolve } from 'path'

/**
 * Repairs text.cham.md files where open markers were renumbered
 * but close markers were not (bug in first version of renumber-markers.ts).
 *
 * For sequential (non-nested) markers, each close tag's ID identifies the
 * correct ID for the preceding open tag.
 *
 * Usage:
 *   npx tsx src/repair-markers.ts <content-dir> [--dry-run]
 */

function repairFile(filePath: string, dryRun: boolean): number {
  const content = readFileSync(filePath, 'utf-8')
  const markerRe = /\{\/?(\d+)\}/g
  let fixed = 0

  // Collect all markers with positions
  const refs: { start: number; end: number; id: number; isClose: boolean }[] = []
  let m: RegExpExecArray | null
  while ((m = markerRe.exec(content)) !== null) {
    refs.push({
      start: m.index,
      end: m.index + m[0].length,
      id: parseInt(m[1], 10),
      isClose: m[0][1] === '/',
    })
  }

  // Build repair map: for each close tag, find the preceding unmatched open tag
  // and update its ID to match the close tag
  const openStack: number[] = [] // indices into refs
  const repairs = new Map<number, { start: number; end: number; newId: number }>()

  for (let i = 0; i < refs.length; i++) {
    const ref = refs[i]
    if (!ref.isClose) {
      openStack.push(i)
    } else {
      if (openStack.length > 0) {
        const openIdx = openStack.pop()!
        const openRef = refs[openIdx]
        if (openRef.id !== ref.id) {
          repairs.set(openIdx, {
            start: openRef.start,
            end: openRef.end,
            newId: ref.id,
          })
          fixed++
        }
      }
    }
  }

  if (fixed === 0 || dryRun) return fixed

  // Rebuild content with repairs applied (single forward pass).
  const result: string[] = []
  let pos = 0
  const repairByStart = new Map([...repairs.values()].map(r => [r.start, r]))

  for (let i = 0; i < refs.length; i++) {
    const ref = refs[i]
    result.push(content.slice(pos, ref.start))

    const repair = repairByStart.get(ref.start)
    if (repair) {
      result.push(`{${repair.newId}}`)
    } else {
      result.push(content.slice(ref.start, ref.end))
    }
    pos = ref.end
  }
  result.push(content.slice(pos))

  writeFileSync(filePath, result.join(''), 'utf-8')
  return fixed
}

function main(): void {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const contentDir = args.find(a => !a.startsWith('--'))

  if (!contentDir) {
    console.error('Usage: repair-markers <content-dir> [--dry-run]')
    process.exit(1)
  }

  const resolved = resolve(contentDir)
  console.log(`Repairing: ${resolved}`)
  if (dryRun) console.log('(dry run)')

  let totalFixed = 0
  let filesFixed = 0

  for (const pieceDir of readdirSync(resolved).sort()) {
    const textPath = join(resolved, pieceDir, 'text.cham.md')
    if (!existsSync(textPath)) continue

    const fixed = repairFile(textPath, dryRun)
    if (fixed > 0) {
      console.log(`  ${pieceDir}: fixed ${fixed} markers`)
      totalFixed += fixed
      filesFixed++
    }
  }

  console.log(`\nFixed ${totalFixed} markers in ${filesFixed} files`)
}

main()

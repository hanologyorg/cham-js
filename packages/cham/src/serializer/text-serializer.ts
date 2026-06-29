// ─── Text Block Serializer ─────────────────────────────────────
// Serializes TextBlocks and Markers back into CHAM markdown text.
// Handles marker reinsertion (the inverse of parseMarkers).

import type { TextBlock, Marker, MarkerTable, TextSection } from '../types.js'

// ─── Marker Insertion ──────────────────────────────────────────

/**
 * Re-inserts `{N}...{/N}` markers into a clean text string.
 * Open markers are inserted at their offset; close markers at offset+length.
 */
export function insertMarkers(text: string, markers: Marker[]): string {
  if (markers.length === 0) return text

  type Ins = { offset: number; text: string; isClose: boolean }
  const insertions: Ins[] = []

  for (const m of markers) {
    if (m.length > 0) {
      insertions.push({ offset: m.offset, text: `{${m.id}}`, isClose: false })
      insertions.push({ offset: m.offset + m.length, text: `{/${m.id}}`, isClose: true })
    }
  }

  insertions.sort((a, b) => {
    if (a.offset !== b.offset) return b.offset - a.offset
    return a.isClose ? -1 : b.isClose ? 1 : 0
  })

  let result = text
  for (const ins of insertions)
    result = result.slice(0, ins.offset) + ins.text + result.slice(ins.offset)
  return result
}

// ─── Text Block Serialization ──────────────────────────────────

/**
 * Serializes a list of text blocks with their markers and text-section headers
 * into the body portion of a CHAM markdown document.
 */
export function serializeTextBlocks(
  textBlocks: TextBlock[],
  markers: MarkerTable,
  textSections: TextSection[],
): string {
  if (textBlocks.length === 0) return ''

  const markersByBlock = new Map<number, Marker[]>()
  for (const [, m] of markers) {
    const arr = markersByBlock.get(m.blockIndex) || []
    arr.push(m)
    markersByBlock.set(m.blockIndex, arr)
  }

  const sectionStartMap = new Map<number, TextSection>()
  for (const s of textSections) {
    sectionStartMap.set(s.startBlock, s)
  }

  const lines: string[] = []
  let prevSectionIndex = textBlocks[0].sectionIndex

  for (let i = 0; i < textBlocks.length; i++) {
    const block = textBlocks[i]
    const startingSection = sectionStartMap.get(i)

    if (i > 0) {
      lines.push('')
      if (block.sectionIndex !== prevSectionIndex || startingSection) lines.push('')
    }

    if (startingSection) {
      const label = startingSection.label ? `:${startingSection.label}` : ''
      lines.push(`### ${startingSection.level}${label}`)
      lines.push('')
    }

    const blockMarkers = (markersByBlock.get(i) || []).sort((a, b) => a.offset - b.offset)
    lines.push(insertMarkers(block.text, blockMarkers))
    prevSectionIndex = block.sectionIndex
  }

  return lines.join('\n')
}

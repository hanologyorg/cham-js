// ─── Verse Grouper ─────────────────────────────────────────────
// Groups text blocks into verses based on zero-width (close-only) markers.
// Remaps annotation ranges from block-level to verse-group-level.

import type { OutputAnnotation } from '../types.js'

interface MarkerInfo {
  id: number
  blockIndex: number
  offset: number
  length: number
}

/**
 * Groups text blocks into "verses" using zero-width markers as boundaries.
 *
 * The CHAM verse model: a "verse" is a sequence of consecutive text blocks
 * grouped together for display. Zero-width markers (`{N}{/N}` with no text
 * between them) act as verse boundaries — each zero-width marker ends a verse.
 *
 * If there are no zero-width markers, each block is its own verse (1:1 mapping).
 */
export function groupBlocksIntoVerses(
  textBlocks: { text: string }[],
  markers: Map<number, MarkerInfo>,
): {
  verses: { text: string }[]
  blockToVerse: number[]
  verseCharOffset: number[][]
} {
  if (textBlocks.length === 0) {
    return { verses: [], blockToVerse: [], verseCharOffset: [] }
  }

  if (markers.size === 0) {
    return {
      verses: textBlocks.map(b => ({ text: b.text })),
      blockToVerse: textBlocks.map((_, i) => i),
      verseCharOffset: textBlocks.map(() => [0]),
    }
  }

  const closeMarkers = [...markers.values()]
    .filter(m => m.length === 0)
    .sort((a, b) => a.blockIndex - b.blockIndex)

  if (closeMarkers.length === 0) {
    return {
      verses: textBlocks.map(b => ({ text: b.text })),
      blockToVerse: textBlocks.map((_, i) => i),
      verseCharOffset: textBlocks.map(() => [0]),
    }
  }

  const blockToVerse: number[] = new Array(textBlocks.length)
  const verseTexts: string[] = []
  const verseCharOffset: number[][] = []
  let currentVerse = 0
  let nextBoundary = 0

  const blockTexts: string[] = []
  const blockOffsets: number[] = []

  for (let i = 0; i < textBlocks.length; i++) {
    blockToVerse[i] = currentVerse
    const offset = blockTexts.reduce((sum, t) => sum + t.length, 0)
    blockOffsets.push(offset)
    blockTexts.push(textBlocks[i].text)

    if (nextBoundary < closeMarkers.length && i === closeMarkers[nextBoundary].blockIndex) {
      verseTexts.push(blockTexts.join(''))
      verseCharOffset.push([...blockOffsets])
      blockTexts.length = 0
      blockOffsets.length = 0
      currentVerse++
      nextBoundary++
    }
  }

  if (blockTexts.length > 0) {
    verseTexts.push(blockTexts.join(''))
    verseCharOffset.push([...blockOffsets])
  }

  return {
    verses: verseTexts.map(t => ({ text: t })),
    blockToVerse,
    verseCharOffset,
  }
}

/**
 * Remaps annotation ranges from block-level indices to verse-group indices.
 * Adjusts character offsets to account for the merged verse text.
 */
export function remapAnnotationVerses(
  annotations: OutputAnnotation[],
  blockToVerse: number[],
  verseCharOffset: number[][],
): OutputAnnotation[] {
  return annotations.map(ann => {
    if (ann.range.scope !== 'verse' || ann.range.verseIndex === undefined) return ann
    const blockIdx = ann.range.verseIndex
    if (blockIdx >= blockToVerse.length) return ann
    const verseIdx = blockToVerse[blockIdx]
    const offsets = verseCharOffset[verseIdx]
    if (!offsets) return ann

    // Find this block's position within the merged verse
    let posInVerse = 0
    for (let i = 0; i < blockIdx; i++) {
      if (blockToVerse[i] === verseIdx) posInVerse++
    }

    const charOffset = offsets[posInVerse] ?? 0
    const adjustedStart = charOffset + (ann.range.start ?? 0)
    const adjustedEnd = charOffset + (ann.range.end ?? 0)

    return {
      ...ann,
      range: {
        ...ann.range,
        verseIndex: verseIdx,
        start: adjustedStart,
        end: adjustedEnd,
      },
    }
  })
}

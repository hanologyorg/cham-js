// ─── Text Block & Marker Parser ────────────────────────────────
// Parses the body of a CHAM document into TextBlocks and a MarkerTable.
// Also handles text-section headers (### LEVEL[:LABEL]) embedded in the body.

import type {
  TextBlock, Marker, MarkerTable, TextSection,
} from '../types.js'

// ─── Marker Position Tracking ──────────────────────────────────

interface MarkerPosition {
  id: number
  type: 'open' | 'close'
  sourceOffset: number
}

/**
 * Extracts `{N}` and `{/N}` markers from a text source string.
 * Returns the clean text (with markers stripped) and a list of marker positions
 * referencing character offsets within the clean text.
 */
export function parseMarkers(source: string): { clean: string; positions: MarkerPosition[] } {
  const positions: MarkerPosition[] = []
  const chars: string[] = []
  let i = 0

  while (i < source.length) {
    if (source[i] === '{') {
      const closeIdx = source.indexOf('}', i)
      if (closeIdx === -1) { chars.push(source[i]); i++; continue }

      const inner = source.slice(i + 1, closeIdx)
      if (inner.startsWith('/')) {
        const num = parseInt(inner.slice(1), 10)
        if (!isNaN(num)) {
          positions.push({ id: num, type: 'close', sourceOffset: chars.length })
          i = closeIdx + 1
          continue
        }
      } else {
        const num = parseInt(inner, 10)
        if (!isNaN(num) && String(num) === inner) {
          positions.push({ id: num, type: 'open', sourceOffset: chars.length })
          i = closeIdx + 1
          continue
        }
      }
      chars.push(source[i]); i++
    } else {
      chars.push(source[i]); i++
    }
  }

  return { clean: chars.join(''), positions }
}

// ─── Text Section Headers ──────────────────────────────────────

/**
 * Parses a `### LEVEL[:LABEL]` or `### LEVEL LABEL` text-section header.
 * Returns null if the input doesn't match the header pattern.
 */
export function parseSectionHeader(text: string): { level: string; label?: string } | null {
  const content = text.replace(/^###\s+/, '')
  if (!content) return null
  const colonIdx = content.search(/[：:]/)
  if (colonIdx !== -1) {
    return { level: content.slice(0, colonIdx).trim(), label: content.slice(colonIdx + 1).trim() || undefined }
  }
  const spaceIdx = content.indexOf(' ')
  if (spaceIdx !== -1) {
    return { level: content.slice(0, spaceIdx).trim(), label: content.slice(spaceIdx + 1).trim() || undefined }
  }
  return { level: content.trim() }
}

// ─── Body Splitting ────────────────────────────────────────────

/**
 * Splits a document body into the text portion (before any `## Section`)
 * and the annotation portion (from the first `## Section` onward).
 */
export function splitBodyAndAnnotations(body: string): {
  textBody: string
  annotationBody: string
  bodyLineOffset: number
} {
  const lines = body.split('\n')
  let splitIdx = lines.length
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('## ')) { splitIdx = i; break }
  }
  return {
    textBody: lines.slice(0, splitIdx).join('\n'),
    annotationBody: lines.slice(splitIdx).join('\n'),
    bodyLineOffset: splitIdx > 0 ? 1 : 0, // frontmatter takes lines 0-N, body starts after
  }
}

// ─── Text Block & Marker Building ──────────────────────────────

/**
 * Parses the text body into TextBlocks, a MarkerTable, and TextSections.
 *
 * Text blocks are separated by blank lines. Sections (`###`) group
 * consecutive text blocks and are tracked in TextSections.
 *
 * Markers (`{N}...{/N}`) within text blocks are extracted and their
 * character offsets are recorded relative to the flattened (no-newline)
 * block text.
 */
export function buildTextBlocksAndMarkers(
  body: string,
  bodyLineOffset: number = 0,
): {
  textBlocks: TextBlock[]
  markers: MarkerTable
  textSections: TextSection[]
} {
  const markers: MarkerTable = new Map()
  const textBlocks: TextBlock[] = []
  const textSections: TextSection[] = []
  const sectionParts = body.split(/\n{3,}/)
  let globalBlockIndex = 0
  const sectionBlockCounts = new Map<number, number>()

  let currentLine = bodyLineOffset + 1
  let sectionCounter = 0
  let activeTextSectionIdx: number | undefined

  for (let si = 0; si < sectionParts.length; si++) {
    const sectionText = sectionParts[si].trim()
    if (!sectionText) {
      currentLine += sectionParts[si].split('\n').length
      continue
    }

    const blockSources = sectionText.split(/\n{2}/)
    let blockLineStart = currentLine

    for (let bi = 0; bi < blockSources.length; bi++) {
      const blockSource = blockSources[bi]
      const trimmed = blockSource.trim()
      const linesInBlock = blockSource.split('\n').length

      if (!trimmed) {
        blockLineStart += linesInBlock
        continue
      }

      // Check for text section header (### LEVEL[:LABEL])
      if (trimmed.startsWith('### ') && !trimmed.includes('\n')) {
        const header = parseSectionHeader(trimmed)
        if (header) {
          if (activeTextSectionIdx !== undefined) {
            textSections[activeTextSectionIdx].endBlock = globalBlockIndex
          }
          sectionCounter++
          activeTextSectionIdx = textSections.length
          textSections.push({
            level: header.level,
            ...(header.label ? { label: header.label } : {}),
            index: sectionCounter,
            startBlock: globalBlockIndex,
            endBlock: -1,
          })
          blockLineStart += linesInBlock + 2
          continue
        }
      }

      const blockIdxInSection = sectionBlockCounts.get(si) || 0
      sectionBlockCounts.set(si, blockIdxInSection + 1)

      const { clean, positions } = parseMarkers(trimmed)
      const flatText = clean.replace(/\n/g, '')

      textBlocks.push({
        sectionIndex: si,
        blockIndexInSection: blockIdxInSection,
        text: flatText,
        display: clean,
        source: trimmed,
        lineStart: blockLineStart,
        lineEnd: blockLineStart + linesInBlock - 1,
        ...(activeTextSectionIdx !== undefined ? { textSectionIndex: activeTextSectionIdx } : {}),
      })

      extractMarkers(positions, clean, flatText, si, globalBlockIndex, markers)

      globalBlockIndex++
      blockLineStart += linesInBlock + 2 // +2 for the \n\n that split the block
    }

    currentLine = blockLineStart + 1 // +1 for the extra \n that split the section
  }

  // Close last text section
  if (activeTextSectionIdx !== undefined) {
    textSections[activeTextSectionIdx].endBlock = globalBlockIndex
  }

  return { textBlocks, markers, textSections }
}

/**
 * Extracts markers from parsed positions and adds them to the marker table.
 * Computes flat-text offsets (with newlines stripped) for each marker.
 */
function extractMarkers(
  positions: MarkerPosition[],
  clean: string,
  flatText: string,
  sectionIndex: number,
  blockIndex: number,
  markers: MarkerTable,
): void {
  const openMap = new Map<number, number>()
  const closeMap = new Map<number, number>()

  for (const pos of positions) {
    if (pos.type === 'open') openMap.set(pos.id, pos.sourceOffset)
    else closeMap.set(pos.id, pos.sourceOffset)
  }

  for (const id of new Set([...openMap.keys(), ...closeMap.keys()])) {
    const openOff = openMap.get(id)
    const closeOff = closeMap.get(id)

    if (openOff !== undefined && closeOff !== undefined) {
      const flatOpen = clean.slice(0, openOff).replace(/\n/g, '').length
      const flatClose = clean.slice(0, closeOff).replace(/\n/g, '').length
      markers.set(id, {
        id, sectionIndex, blockIndex,
        offset: flatOpen,
        length: flatClose - flatOpen,
        text: flatText.slice(flatOpen, flatClose),
      })
    } else if (closeOff !== undefined) {
      const flatClose = clean.slice(0, closeOff).replace(/\n/g, '').length
      markers.set(id, {
        id, sectionIndex, blockIndex,
        offset: flatClose,
        length: 0,
      })
    }
  }
}

import type {
  ChamMeta, PrimaryMeta, SecondaryMeta, PartMeta, ChamContributor, ChamDate, PieceSource,
  HierarchyLevel, TextSection,
  TextBlock, Marker, MarkerTable,
  AnnotationSection, SectionMeta, AnnotationEntry, AnnotationTarget,
  ChamDocument, ChamPart, BookConfig,
} from './types.js'
import { parseYaml as parseYamlSimple } from './yaml.js'
import { readFileSync, readdirSync, existsSync } from 'fs'
import { join } from 'path'

// ─── Errors ───────────────────────────────────────────────────

export class ChamParseError extends Error {
  constructor(message: string, readonly line?: number) {
    super(line != null ? `Line ${line}: ${message}` : message)
    this.name = 'ChamParseError'
  }
}

// ─── Frontmatter ──────────────────────────────────────────────

function splitFrontmatter(source: string): { meta: string; body: string } {
  const trimmed = source.replace(/^﻿/, '')
  if (!trimmed.startsWith('---')) return { meta: '', body: trimmed }
  const end = trimmed.indexOf('\n---', 3)
  if (end === -1) return { meta: '', body: trimmed }
  const meta = trimmed.slice(3, end)
  const body = trimmed.slice(end + 4)
  return { meta, body: body.startsWith('\n') ? body.slice(1) : body }
}

function buildMeta(raw: Record<string, unknown>): ChamMeta {
  if (raw.base && typeof raw.base === 'string') {
    return {
      type: 'secondary',
      base: raw.base as string,
      contributor: raw.contributor as string | undefined,
      role: raw.role as string | undefined,
      dynasty: raw.dynasty as string | undefined,
      era: raw.era as string | undefined,
      era_year: raw.era_year as number | undefined,
      iso: raw.iso as number | undefined,
      nature: raw.nature as string | undefined,
    }
  }

  if (raw.part != null && typeof raw.part === 'number') {
    const source = raw.source as Record<string, unknown> | undefined
    let partSource: PieceSource | undefined
    if (source) {
      partSource = {
        text: source.text as string | undefined,
        textRef: source.textRef as string | undefined,
        pieceRef: source.pieceRef as number | undefined,
        edition: source.edition as string | undefined,
        publisher: source.publisher as string | undefined,
        page: source.page as string | undefined,
        relation: (source.relation as PieceSource['relation']) || 'standalone',
        range: source.range as PieceSource['range'] | undefined,
      }
    }
    return {
      type: 'part',
      part: raw.part,
      group: raw.group as string | undefined,
      title: raw.title as string | undefined,
      source: partSource,
    }
  }

  const contributors = raw.contributors as Array<Record<string, unknown>> | undefined
  const date = raw.date as Record<string, unknown> | undefined
  const source = raw.source as Record<string, unknown> | undefined

  let pieceSource: PieceSource | undefined
  if (source) {
    pieceSource = {
      text: source.text as string | undefined,
      textRef: source.textRef as string | undefined,
      pieceRef: source.pieceRef as number | undefined,
      edition: source.edition as string | undefined,
      publisher: source.publisher as string | undefined,
      page: source.page as string | undefined,
      relation: (source.relation as PieceSource['relation']) || 'standalone',
      range: source.range as PieceSource['range'] | undefined,
    }
  }

  let hierarchy: HierarchyLevel[] | undefined
  if (raw.hierarchy && Array.isArray(raw.hierarchy)) {
    hierarchy = (raw.hierarchy as Array<Record<string, unknown>>).map(h => ({
      level: h.level as string,
      index: h.index as number,
      label: h.label as string | undefined,
      parent: h.parent as number | string | undefined,
    }))
  }

  return {
    type: 'primary',
    id: raw.id as number | string,
    title: raw.title as string,
    contributors: contributors?.map(c => ({
      ref: c.ref as string,
      role: c.role as ChamContributor['role'],
      ...(c.title ? { title: c.title as string } : {}),
    })),
    date: date ? {
      dynasty: date.dynasty as string | undefined,
      era: date.era as string | undefined,
      eraCode: date.eraCode as string | undefined,
      era_year: date.era_year as number | undefined,
      sexagenary: date.sexagenary as string | undefined,
      iso: date.iso as number | undefined,
      circa: date.circa as boolean | undefined,
    } as ChamDate : undefined,
    genre: raw.genre as PrimaryMeta['genre'],
    source: pieceSource,
    hierarchy,
  }
}

// ─── Text Blocks & Markers ────────────────────────────────────

interface MarkerPosition {
  id: number
  type: 'open' | 'close'
  sourceOffset: number
}

function parseMarkers(source: string): { clean: string; positions: MarkerPosition[] } {
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

function parseSectionHeader(text: string): { level: string; label?: string } | null {
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

function buildTextBlocksAndMarkers(body: string, bodyLineOffset: number = 0): { textBlocks: TextBlock[]; markers: MarkerTable; textSections: TextSection[] } {
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
            label: header.label,
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
        textSectionIndex: activeTextSectionIdx,
      })

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
            id, sectionIndex: si, blockIndex: globalBlockIndex,
            offset: flatOpen, length: flatClose - flatOpen,
            text: flatText.slice(flatOpen, flatClose),
          })
        } else if (closeOff !== undefined) {
          const flatClose = clean.slice(0, closeOff).replace(/\n/g, '').length
          markers.set(id, {
            id, sectionIndex: si, blockIndex: globalBlockIndex,
            offset: flatClose, length: 0,
          })
        }
      }

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

// ─── Annotation Sections ──────────────────────────────────────

function findMatchingBracket(text: string, start: number): number {
  if (text[start] !== '[') return -1
  const afterOpen = text.slice(start + 1)

  const firstClose = afterOpen.indexOf(']')
  const firstNewline = afterOpen.indexOf('\n')

  if (firstClose !== -1 && (firstNewline === -1 || firstClose < firstNewline))
    return start + 1 + firstClose

  const lines = afterOpen.split('\n')
  let offset = 0
  for (const line of lines) {
    if (line.trim() === ']') return start + 1 + offset + line.indexOf(']')
    offset += line.length + 1
  }

  const lastClose = afterOpen.lastIndexOf(']')
  return lastClose !== -1 ? start + 1 + lastClose : -1
}

function parseBracketValue(text: string): { headword?: string; value: string; consumed: number } {
  text = text.trimStart()
  if (!text.startsWith('[')) return { value: '', consumed: 0 }

  const singleEnd = findMatchingBracket(text, 0)
  if (singleEnd === -1) return { value: '', consumed: 0 }

  const first = text.slice(1, singleEnd)
  const afterFirst = text.slice(singleEnd + 1).trimStart()

  if (afterFirst.startsWith('[')) {
    const secondEnd = findMatchingBracket(afterFirst, 0)
    if (secondEnd === -1) return { headword: first, value: '', consumed: singleEnd + 1 }
    return { headword: first, value: afterFirst.slice(1, secondEnd), consumed: singleEnd + 1 + secondEnd + 1 }
  }

  return { value: first, consumed: singleEnd + 1 }
}

function parseAnnotationEntry(line: string): AnnotationEntry | null {
  line = line.trim()
  if (!line) return null

  let target: AnnotationTarget
  let rest: string

  if (line.startsWith('{')) {
    const closeIdx = line.indexOf('}')
    if (closeIdx === -1) return null
    const id = parseInt(line.slice(1, closeIdx), 10)
    if (isNaN(id)) return null
    target = { type: 'marker', markerId: id }
    rest = line.slice(closeIdx + 1).trimStart()
  } else if (line.startsWith('@title')) {
    target = { type: 'title' }
    rest = line.slice(6).trimStart()
  } else if (line.startsWith('@full')) {
    target = { type: 'full' }
    rest = line.slice(5).trimStart()
  } else if (line.startsWith('@verse:') || line.startsWith('@position:')) {
    const prefix = line.startsWith('@verse:') ? '@verse:' : '@position:'
    const spec = line.slice(prefix.length).split(/\s/)[0]
    const colonParts = spec.split(':')
    const l = parseInt(colonParts[0], 10)
    const rangePart = colonParts[1] || '0'
    const rangeParts = rangePart.split('-')
    const c = parseInt(rangeParts[0], 10) || 0
    const e = rangeParts.length > 1 ? parseInt(rangeParts[1], 10) : undefined
    target = { type: 'verse', line: l, char: c, ...(e !== undefined ? { end: e } : {}) }
    rest = line.slice(prefix.length + spec.length).trimStart()
  } else {
    return null
  }

  const kindMatch = rest.match(/^([\w-]+)\s*/)
  if (!kindMatch) return null
  const kind = kindMatch[1]
  rest = rest.slice(kindMatch[0].length)

  const params: Record<string, string> = {}
  while (rest.length > 0) {
    const paramMatch = rest.match(/^(\w+):(\S+)\s*/)
    if (!paramMatch) break
    params[paramMatch[1]] = paramMatch[2]
    rest = rest.slice(paramMatch[0].length)
  }

  const { headword, value, consumed } = parseBracketValue(rest)
  return { target, kind, params, headword, value }
}

function parseAnnotationSections(body: string): AnnotationSection[] {
  const sections: AnnotationSection[] = []
  const lines = body.split('\n')
  let i = 0

  while (i < lines.length && !lines[i].startsWith('## ')) i++

  while (i < lines.length) {
    if (!lines[i].startsWith('## ')) { i++; continue }

    const name = lines[i].slice(3).trim()
    i++

    const metaLines: string[] = []
    while (i < lines.length && lines[i].startsWith('@')) metaLines.push(lines[i++])
    const meta: SectionMeta = {}
    for (const ml of metaLines) {
      const ci = ml.indexOf(':')
      if (ci === -1) continue
      ;(meta as Record<string, unknown>)[ml.slice(1, ci).trim()] = ml.slice(ci + 1).trim()
    }

    const entries: AnnotationEntry[] = []
    let pendingMultiline = ''
    let inMultiline = false

    while (i < lines.length) {
      const entryLine = lines[i]
      if (entryLine.startsWith('## ')) break

      if (inMultiline) {
        if (entryLine.trim() === ']') {
          pendingMultiline += '\n]'
          const entry = parseAnnotationEntry(pendingMultiline)
          if (entry) entries.push(entry)
          inMultiline = false
          pendingMultiline = ''
          i++
          continue
        }
        pendingMultiline += '\n' + entryLine
        i++
        continue
      }

      const trimmed = entryLine.trim()
      if (!trimmed) { i++; continue }

      const openBrackets = (trimmed.match(/\[/g) || []).length
      const closeBrackets = (trimmed.match(/\]/g) || []).length
      if (openBrackets > closeBrackets) {
        pendingMultiline = trimmed
        inMultiline = true
        i++
        continue
      }

      const entry = parseAnnotationEntry(trimmed)
      if (entry) entries.push(entry)
      i++
    }

    sections.push({ name, meta, entries })
  }

  return sections
}

// ─── Body Splitting ───────────────────────────────────────────

function splitBodyAndAnnotations(body: string): { textBody: string; annotationBody: string; bodyLineOffset: number } {
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

// ─── Parser Class ─────────────────────────────────────────────

export class ChamParser {
  parse(source: string): ChamDocument {
    const { meta: metaStr, body } = splitFrontmatter(source)
    const raw = parseYamlSimple(metaStr)
    const meta = buildMeta(raw)

    const { textBody, annotationBody, bodyLineOffset } = splitBodyAndAnnotations(body)
    const { textBlocks, markers, textSections } = buildTextBlocksAndMarkers(textBody, bodyLineOffset)
    const sections = parseAnnotationSections(annotationBody)

    return { meta, textBlocks, markers, textSections, sections }
  }

  parsePiece(pieceDir: string, bookConfig?: BookConfig): ChamDocument {
    const chamPath = join(pieceDir, 'text.cham.md')
    if (!existsSync(chamPath)) throw new ChamParseError(`Missing text.cham.md in ${pieceDir}`)

    const primary = this.parse(readFileSync(chamPath, 'utf-8'))
    if (primary.meta.type !== 'primary') {
      throw new ChamParseError(`Expected primary frontmatter type in ${chamPath}`)
    }

    const mergedSections = [...primary.sections]

    for (const f of readdirSync(pieceDir).sort()) {
      if (!f.endsWith('.cham.md') || f === 'text.cham.md') continue
      const filePath = join(pieceDir, f)
      const src = readFileSync(filePath, 'utf-8')
      const sub = this.parse(src)

      if (sub.meta.type !== 'secondary') continue

      for (const entry of sub.sections.flatMap(s => s.entries)) {
        if (entry.target.type === 'marker' && !primary.markers.has(entry.target.markerId)) {
          throw new ChamParseError(
            `Subordinate ${f} references marker {${entry.target.markerId}} not in primary text`,
          )
        }
      }

      mergedSections.push(...sub.sections)
    }

    if (bookConfig) {
      const pm = primary.meta as PrimaryMeta
      if (!pm.contributors?.length && bookConfig.contributors?.length) {
        (primary.meta as PrimaryMeta).contributors = bookConfig.contributors
      }
      if (!pm.genre && bookConfig.genre) {
        (primary.meta as PrimaryMeta).genre = bookConfig.genre
      }
      if (!pm.date && bookConfig.date) {
        (primary.meta as PrimaryMeta).date = bookConfig.date
      }
    }

    // Discover and parse part files
    const parts: ChamPart[] = []
    for (const f of readdirSync(pieceDir).sort()) {
      if (!f.startsWith('part-') || !f.endsWith('.cham.md')) continue
      const partDoc = this.parse(readFileSync(join(pieceDir, f), 'utf-8'))
      if (partDoc.meta.type !== 'part') continue
      parts.push(partDoc as ChamPart)
    }
    parts.sort((a, b) => a.meta.part - b.meta.part)

    return { ...primary, sections: mergedSections, textSections: primary.textSections, ...(parts.length ? { parts } : {}) }
  }
}

export function parse(source: string): ChamDocument {
  return new ChamParser().parse(source)
}

export { splitFrontmatter, parseAnnotationEntry }

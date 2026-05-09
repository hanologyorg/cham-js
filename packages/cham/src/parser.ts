import type {
  ChamMeta, PrimaryMeta, SecondaryMeta, ChamContributor, ChamDate, PieceSource,
  TextBlock, Marker, MarkerTable,
  AnnotationSection, SectionMeta, AnnotationEntry, AnnotationTarget,
  ChamDocument,
} from './types.js'

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

function parseValue(val: string): unknown {
  if (val === 'true') return true
  if (val === 'false') return false
  if (val === 'null' || val === '~') return null
  if (/^-?\d+$/.test(val)) return parseInt(val, 10)
  if (/^-?\d+\.\d+$/.test(val)) return parseFloat(val)
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'")))
    return val.slice(1, -1)
  if (val.startsWith('[') && val.endsWith(']'))
    return val.slice(1, -1).split(',').map(s => parseValue(s.trim()))
  return val
}

interface YamlContext {
  result: Record<string, unknown>
  nestingKey: string
  inArray: boolean
  arrayItems: unknown[]
  currentObj: Record<string, unknown> | null
}

function parseYamlSimple(text: string): Record<string, unknown> {
  const ctx: YamlContext = {
    result: {},
    nestingKey: '',
    inArray: false,
    arrayItems: [],
    currentObj: null,
  }

  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    if (line.length - line.trimStart().length > 0 && ctx.nestingKey) {
      handleIndented(ctx, trimmed)
      continue
    }

    closeNesting(ctx)
    handleTopLevel(ctx, trimmed)
  }

  closeNesting(ctx)
  return ctx.result
}

function handleIndented(ctx: YamlContext, trimmed: string): void {
  if (ctx.inArray && trimmed.startsWith('- ')) {
    const val = trimmed.slice(2).trim()
    if (val.includes(':')) {
      const obj: Record<string, unknown> = {}
      const colonIdx = val.indexOf(':')
      obj[val.slice(0, colonIdx).trim()] = parseValue(val.slice(colonIdx + 1).trim())
      ctx.arrayItems.push(obj)
      ctx.currentObj = obj
    } else {
      ctx.arrayItems.push(parseValue(val))
      ctx.currentObj = null
    }
    return
  }

  if (ctx.inArray && ctx.currentObj && trimmed.includes(':') && !trimmed.startsWith('-')) {
    const colonIdx = trimmed.indexOf(':')
    ctx.currentObj[trimmed.slice(0, colonIdx).trim()] = parseValue(trimmed.slice(colonIdx + 1).trim())
    return
  }

  if (trimmed.includes(':')) {
    const colonIdx = trimmed.indexOf(':')
    const subKey = trimmed.slice(0, colonIdx).trim()
    const subVal = trimmed.slice(colonIdx + 1).trim()
    const parent = ctx.result[ctx.nestingKey]
    if (parent && typeof parent === 'object' && !Array.isArray(parent)) {
      ;(parent as Record<string, unknown>)[subKey] = parseValue(subVal)
    }
  }
}

function handleTopLevel(ctx: YamlContext, trimmed: string): void {
  const colonIdx = trimmed.indexOf(':')
  if (colonIdx === -1) return

  const key = trimmed.slice(0, colonIdx).trim()
  const val = trimmed.slice(colonIdx + 1).trim()

  if (val === '') {
    if (key === 'contributors' || key === 'layers' || key === 'volumes') {
      ctx.inArray = true
      ctx.nestingKey = key
      ctx.arrayItems = []
    } else if (key === 'date' || key === 'source' || key === 'range') {
      ctx.result[key] = {}
      ctx.nestingKey = key
    }
    return
  }

  if (key.includes('.')) {
    const parts = key.split('.')
    let target: Record<string, unknown> = ctx.result
    for (let i = 0; i < parts.length - 1; i++) {
      if (!target[parts[i]]) target[parts[i]] = {}
      target = target[parts[i]] as Record<string, unknown>
    }
    target[parts[parts.length - 1]] = parseValue(val)
  } else {
    ctx.result[key] = parseValue(val)
  }
}

function closeNesting(ctx: YamlContext): void {
  if (!ctx.nestingKey) return
  if (ctx.inArray) ctx.result[ctx.nestingKey] = ctx.arrayItems
  ctx.inArray = false
  ctx.arrayItems = []
  ctx.currentObj = null
  ctx.nestingKey = ''
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

  const contributors = raw.contributors as Array<Record<string, unknown>> | undefined
  const date = raw.date as Record<string, unknown> | undefined
  const source = raw.source as Record<string, unknown> | undefined

  let pieceSource: PieceSource | undefined
  if (source) {
    pieceSource = {
      text: source.text as string | undefined,
      textRef: source.textRef as string | undefined,
      pieceRef: source.pieceRef as number | undefined,
      relation: (source.relation as PieceSource['relation']) || 'standalone',
      range: source.range as PieceSource['range'] | undefined,
    }
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
      era_year: date.era_year as number | undefined,
      sexagenary: date.sexagenary as string | undefined,
      iso: date.iso as number | undefined,
      circa: date.circa as boolean | undefined,
    } as ChamDate : undefined,
    genre: raw.genre as PrimaryMeta['genre'],
    source: pieceSource,
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

function buildTextBlocksAndMarkers(body: string): { textBlocks: TextBlock[]; markers: MarkerTable } {
  const markers: MarkerTable = new Map()
  const textBlocks: TextBlock[] = []
  const sectionParts = body.split(/\n{3,}/)
  let globalBlockIndex = 0

  for (let si = 0; si < sectionParts.length; si++) {
    const sectionText = sectionParts[si].trim()
    if (!sectionText) continue

    for (const blockSource of sectionText.split(/\n{2}/)) {
      const trimmed = blockSource.trim()
      if (!trimmed) continue

      const { clean, positions } = parseMarkers(trimmed)
      const flatText = clean.replace(/\n/g, '')

      textBlocks.push({
        sectionIndex: si,
        blockIndexInSection: textBlocks.filter(b => b.sectionIndex === si).length,
        text: flatText,
        display: clean,
        source: trimmed,
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
    }
  }

  return { textBlocks, markers }
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
  } else if (line.startsWith('@verse:')) {
    const spec = line.slice(7).split(/\s/)[0]
    const [l, c] = spec.split(':').map(Number)
    target = { type: 'verse', line: l, char: c || 0 }
    rest = line.slice(7 + spec.length).trimStart()
  } else {
    return null
  }

  const kindMatch = rest.match(/^(\w+)\s*/)
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

function splitBodyAndAnnotations(body: string): { textBody: string; annotationBody: string } {
  const lines = body.split('\n')
  let splitIdx = lines.length
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('## ')) { splitIdx = i; break }
  }
  return {
    textBody: lines.slice(0, splitIdx).join('\n'),
    annotationBody: lines.slice(splitIdx).join('\n'),
  }
}

// ─── Parser Class ─────────────────────────────────────────────

export class ChamParser {
  parse(source: string): ChamDocument {
    const { meta: metaStr, body } = splitFrontmatter(source)
    const raw = parseYamlSimple(metaStr)
    const meta = buildMeta(raw)

    const { textBody, annotationBody } = splitBodyAndAnnotations(body)
    const { textBlocks, markers } = buildTextBlocksAndMarkers(textBody)
    const sections = parseAnnotationSections(annotationBody)

    return { meta, textBlocks, markers, sections }
  }
}

export function parse(source: string): ChamDocument {
  return new ChamParser().parse(source)
}

export { splitFrontmatter, parseYamlSimple, parseMarkers, parseAnnotationEntry }

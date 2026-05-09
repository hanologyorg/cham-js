import type {
  ChamMeta, PrimaryMeta, SecondaryMeta,
  TextBlock, Marker, MarkerTable,
  AnnotationSection, AnnotationEntry, AnnotationTarget,
} from './types.js'
import { isSecondaryMeta } from './types.js'

// ─── YAML Helpers ─────────────────────────────────────────────

function serializeValue(val: unknown): string {
  if (val === null || val === undefined) return 'null'
  if (typeof val === 'boolean') return val ? 'true' : 'false'
  if (typeof val === 'number') return String(val)
  if (typeof val === 'string') {
    if (/[:#\n{}[\],&*?|>!'"%@`]/.test(val))
      return `'${val.replace(/'/g, "''")}'`
    return val
  }
  return String(val)
}

function serializePrimaryMeta(meta: PrimaryMeta): string[] {
  const lines: string[] = [
    `id: ${serializeValue(meta.id)}`,
    `title: ${serializeValue(meta.title)}`,
  ]

  if (meta.contributors?.length) {
    lines.push('contributors:')
    for (const c of meta.contributors) {
      lines.push(`  - ref: ${serializeValue(c.ref)}`)
      lines.push(`    role: ${serializeValue(c.role)}`)
    }
  }

  if (meta.date) {
    lines.push('date:')
    if (meta.date.dynasty) lines.push(`  dynasty: ${serializeValue(meta.date.dynasty)}`)
    if (meta.date.era) lines.push(`  era: ${serializeValue(meta.date.era)}`)
    if (meta.date.era_year !== undefined) lines.push(`  era_year: ${meta.date.era_year}`)
    if (meta.date.sexagenary) lines.push(`  sexagenary: ${serializeValue(meta.date.sexagenary)}`)
    if (meta.date.iso !== undefined) lines.push(`  iso: ${meta.date.iso}`)
    if (meta.date.circa) lines.push('  circa: true')
  }

  if (meta.genre) lines.push(`genre: ${serializeValue(meta.genre)}`)
  return lines
}

function serializeSecondaryMeta(meta: SecondaryMeta): string[] {
  const lines: string[] = [`base: ${serializeValue(meta.base)}`]
  if (meta.contributor) lines.push(`contributor: ${serializeValue(meta.contributor)}`)
  if (meta.role) lines.push(`role: ${serializeValue(meta.role)}`)
  if (meta.dynasty) lines.push(`dynasty: ${serializeValue(meta.dynasty)}`)
  if (meta.nature) lines.push(`nature: ${serializeValue(meta.nature)}`)
  return lines
}

function serializeFrontmatter(meta: ChamMeta): string {
  const lines = isSecondaryMeta(meta)
    ? serializeSecondaryMeta(meta)
    : serializePrimaryMeta(meta as PrimaryMeta)
  return `---\n${lines.join('\n')}\n---`
}

// ─── Marker Insertion ─────────────────────────────────────────

function insertMarkers(text: string, markers: Marker[]): string {
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

function serializeTextBlocks(textBlocks: TextBlock[], markers: MarkerTable): string {
  if (textBlocks.length === 0) return ''

  const markersByBlock = new Map<number, Marker[]>()
  for (const [, m] of markers) {
    const arr = markersByBlock.get(m.blockIndex) || []
    arr.push(m)
    markersByBlock.set(m.blockIndex, arr)
  }

  const lines: string[] = []
  let prevSection = textBlocks[0].sectionIndex

  for (let i = 0; i < textBlocks.length; i++) {
    const block = textBlocks[i]

    if (i > 0) {
      lines.push('')
      if (block.sectionIndex !== prevSection) lines.push('')
    }

    const blockMarkers = (markersByBlock.get(i) || []).sort((a, b) => a.offset - b.offset)
    lines.push(insertMarkers(block.text, blockMarkers))
    prevSection = block.sectionIndex
  }

  return lines.join('\n')
}

// ─── Annotation Serialization ─────────────────────────────────

function serializeTarget(target: AnnotationTarget): string {
  switch (target.type) {
    case 'marker': return `{${target.markerId}}`
    case 'title': return '@title'
    case 'full': return '@full'
    case 'verse': return `@verse:${target.line}:${target.char}`
  }
}

function serializeParams(params: Record<string, string>): string {
  const entries = Object.entries(params)
  return entries.length ? ' ' + entries.map(([k, v]) => `${k}:${v}`).join(' ') : ''
}

function serializeBracket(value: string, headword?: string): string {
  const needsMultiline = value.includes('\n')
  const hw = headword ? `[${headword}]` : ''

  if (needsMultiline) {
    return `${hw}[\n${value.replace(/^\n+/, '').replace(/\n+$/, '')}\n]`
  }
  return headword ? `[${headword}][${value}]` : `[${value}]`
}

function serializeEntry(entry: AnnotationEntry): string {
  return `${serializeTarget(entry.target)} ${entry.kind}${serializeParams(entry.params)} ${serializeBracket(entry.value, entry.headword)}`
}

function serializeSection(section: AnnotationSection): string {
  const lines: string[] = [`## ${section.name}`]

  const m = section.meta
  if (m.contributor) lines.push(`@contributor: ${m.contributor}`)
  if (m.role) lines.push(`@role: ${m.role}`)
  if (m.dynasty) lines.push(`@dynasty: ${m.dynasty}`)
  if (m.era) lines.push(`@era: ${m.era}`)
  if (m.era_year !== undefined) lines.push(`@era_year: ${m.era_year}`)
  if (m.iso !== undefined) lines.push(`@iso: ${m.iso}`)
  if (m.nature) lines.push(`@nature: ${m.nature}`)

  for (const entry of section.entries) {
    lines.push('')
    lines.push(serializeEntry(entry))
  }

  return lines.join('\n')
}

// ─── Serializer Class ─────────────────────────────────────────

export class ChamSerializer {
  serialize(doc: import('./types.js').ChamDocument): string {
    const parts: string[] = [serializeFrontmatter(doc.meta)]

    const textPart = serializeTextBlocks(doc.textBlocks, doc.markers)
    if (textPart) parts.push(textPart)

    for (const section of doc.sections) {
      parts.push('')
      parts.push(serializeSection(section))
    }

    return parts.join('\n\n')
  }
}

export function serialize(doc: import('./types.js').ChamDocument): string {
  return new ChamSerializer().serialize(doc)
}

export { serializeFrontmatter, serializeEntry, serializeSection }

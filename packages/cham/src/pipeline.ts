import { parse } from './parser.js'
import { parseYaml } from './yaml.js'
import type {
  BookConfig, BookMeta, BookData, LibraryIndex, LibraryScale, CrossRef,
  OutputPiece, OutputAnnotation, OutputRange, OutputAnnotationLayer, OutputProseSection,
  ChamDocument, ChamPart, PrimaryMeta, AnnotationEntry, PieceContributor, PieceSource,
  OutputPart, AuthorRecord,
} from './types.js'

// ─── Kind Mapping ─────────────────────────────────────────────

export function mapKind(kind: string): string {
  if (kind === 'pron') return 'pronunciation'
  if (kind === 'meaning') return 'semantic'
  return kind
}

// ─── Range Building ───────────────────────────────────────────

export function entryToRange(entry: AnnotationEntry, doc: ChamDocument): OutputRange | null {
  switch (entry.target.type) {
    case 'title':
      return { type: 'range', scope: 'title', start: 0, end: 1 }
    case 'full':
      return { type: 'range', scope: 'title', start: 0, end: 0 }
    case 'marker': {
      const marker = doc.markers.get(entry.target.markerId)
      if (!marker) return { type: 'range', scope: 'title', start: 0, end: 1 }
      return {
        type: 'range',
        scope: 'verse',
        verseIndex: marker.blockIndex,
        start: marker.offset,
        end: marker.offset + marker.length,
      }
    }
    case 'verse':
      return {
        type: 'range',
        scope: 'verse',
        verseIndex: entry.target.line,
        start: entry.target.char,
        end: entry.target.end ?? entry.target.char + 1,
      }
  }
}

// ─── Annotation Building ──────────────────────────────────────

export function buildAnnotations(doc: ChamDocument, pieceId: number): OutputAnnotation[] {
  const annotations: OutputAnnotation[] = []
  let annId = 1
  for (const section of doc.sections) {
    for (const entry of section.entries) {
      const range = entryToRange(entry, doc)
      if (!range) continue
      annotations.push({
        id: `${pieceId}-${annId++}`,
        range,
        kind: mapKind(entry.kind),
        lang: entry.params.lang,
        text: entry.value.trim(),
        source: 'cham',
      })
    }
  }
  return annotations
}

export function buildAnnotationsFromLayer(
  layerDoc: ChamDocument, primaryDoc: ChamDocument, layerId: string,
): OutputAnnotation[] {
  const annotations: OutputAnnotation[] = []
  let annId = 1
  for (const section of layerDoc.sections) {
    for (const entry of section.entries) {
      const range = entryToRange(entry, primaryDoc)
      if (!range) continue
      annotations.push({
        id: `${layerId}-${annId++}`,
        range,
        kind: mapKind(entry.kind),
        lang: entry.params.lang,
        text: entry.value,
        source: 'cham',
      })
    }
  }
  return annotations
}

// ─── Headword & Annotation Text ───────────────────────────────

export function getHeadword(doc: ChamDocument, ann: OutputAnnotation): string {
  if (ann.range.scope === 'title') {
    return (doc.meta as PrimaryMeta).title.slice(ann.range.start, ann.range.end)
  }
  if (ann.range.scope === 'verse' && ann.range.verseIndex !== undefined) {
    const block = doc.textBlocks[ann.range.verseIndex]
    if (block) return block.text.slice(ann.range.start, ann.range.end)
  }
  return ''
}

export function buildAnnotationsText(doc: ChamDocument, annotations: OutputAnnotation[]): string {
  if (!annotations.length) return ''

  const groups = new Map<string, { headword: string; pron: OutputAnnotation[]; meaning: OutputAnnotation[] }>()
  for (const ann of annotations) {
    const key = `${ann.range.scope}:${ann.range.verseIndex ?? ''}:${ann.range.start}:${ann.range.end}`
    if (!groups.has(key)) {
      groups.set(key, { headword: getHeadword(doc, ann), pron: [], meaning: [] })
    }
    const g = groups.get(key)!
    if (ann.kind === 'pronunciation') g.pron.push(ann)
    else g.meaning.push(ann)
  }

  const lines: string[] = []
  let num = 1
  for (const [, g] of groups) {
    const parts: string[] = []
    if (g.pron.length) {
      const pronParts = g.pron.map(a => {
        const lang = a.lang === 'yue' ? '粵' : '普'
        return `○${lang}${a.text}`
      })
      parts.push(pronParts.join('；'))
    }
    for (const m of g.meaning) {
      parts.push(m.text)
    }
    lines.push(`${num}.${g.headword}：${parts.join('。')}`)
    num++
  }

  return lines.join('\n')
}

// ─── Verse Grouping ──────────────────────────────────────────────

interface MarkerInfo { id: number; blockIndex: number; offset: number; length: number }

function groupBlocksIntoVerses(
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
      verseTexts.push(blockTexts.join(' '))
      verseCharOffset.push([...blockOffsets])
      blockTexts.length = 0
      blockOffsets.length = 0
      currentVerse++
      nextBoundary++
    }
  }

  if (blockTexts.length > 0) {
    verseTexts.push(blockTexts.join(' '))
    verseCharOffset.push([...blockOffsets])
  }

  return {
    verses: verseTexts.map(t => ({ text: t })),
    blockToVerse,
    verseCharOffset,
  }
}

function remapAnnotationVerses(
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

// ─── Annotation Layers ────────────────────────────────────────

export function buildAnnotationLayers(
  layerAnnotations: Record<string, OutputAnnotation[]>,
  bookConfig: BookConfig,
): OutputAnnotationLayer[] {
  const bookLayers = bookConfig.layers || []
  if (bookLayers.length === 0 && Object.keys(layerAnnotations).length === 0) return []

  const result: OutputAnnotationLayer[] = []

  result.push({
    id: 'default',
    label: bookConfig.annotation?.defaultLabel || '原文',
    shortLabel: bookConfig.annotation?.defaultShortLabel || '文',
    contributor: bookConfig.contributors?.[0]?.ref || '',
    role: 'author',
    nature: 'annotation',
    displayOrder: 0,
    enabled: true,
    annotations: [],
  })

  for (const bookLayer of bookLayers) {
    const annotations = layerAnnotations[bookLayer.id] || []
    result.push({
      id: bookLayer.id,
      label: bookLayer.label,
      shortLabel: bookLayer.shortLabel || bookLayer.label.charAt(0),
      contributor: bookLayer.contributor,
      role: bookLayer.role || 'commentator',
      nature: bookLayer.nature || 'commentary',
      displayOrder: bookLayer.displayOrder ?? result.length,
      enabled: bookLayer.enabled !== false,
      annotations,
    })
  }

  return result
}

// ─── Markdown Helpers ─────────────────────────────────────────

export function cleanHardWraps(text: string): string {
  return text
    .split('\n\n')
    .map(seg => seg.replace(/\n/g, ''))
    .join('\n\n')
}

export function splitMdFrontmatter(content: string): {
  frontmatter: Record<string, unknown> | null
  body: string
} {
  const trimmed = content.replace(/^﻿/, '')
  if (!trimmed.startsWith('---')) return { frontmatter: null, body: trimmed }
  const end = trimmed.indexOf('\n---', 3)
  if (end === -1) return { frontmatter: null, body: trimmed }
  try {
    const fm = parseYaml(trimmed.slice(3, end))
    const body = trimmed.slice(end + 4)
    return { frontmatter: fm, body: body.startsWith('\n') ? body.slice(1) : body }
  } catch {
    return { frontmatter: null, body: trimmed.slice(end + 4) }
  }
}

// ─── Prose Sections ───────────────────────────────────────────

const BUILTIN_PROSE_FILES: Record<string, { key: string; title: string; order: number }> = {
  'author-brief.md': { key: 'author_bio', title: '作者簡介', order: 1 },
  'background.md': { key: 'background', title: '背景資料', order: 2 },
  'analysis.md': { key: 'analysis', title: '賞析', order: 3 },
  'follow-up.md': { key: 'follow_up', title: '延伸活動', order: 4 },
  'think-questions.md': { key: 'think_questions', title: '思考問題', order: 5 },
  'preparation.md': { key: 'preparation', title: '教學準備', order: 6 },
}

export function parseProseSections(
  files: Map<string, string>,
): { sections: Record<string, string>; structuredSections: OutputProseSection[] } {
  const sections: Record<string, string> = {}
  const structured: OutputProseSection[] = []

  for (const [filename, content] of files) {
    if (!filename.endsWith('.md') || filename.endsWith('.cham.md')) continue
    if (filename.startsWith('_')) continue

    const { frontmatter, body } = splitMdFrontmatter(content)
    const builtin = BUILTIN_PROSE_FILES[filename]
    let key: string, title: string, order: number

    if (builtin) {
      key = builtin.key
      title = (frontmatter?.title as string) || builtin.title
      order = (frontmatter?.order as number) ?? builtin.order
    } else if (filename.startsWith('custom-')) {
      const stem = filename.slice(7, -3)
      key = `custom_${stem}`
      title = (frontmatter?.title as string) || stem
      order = (frontmatter?.order as number) ?? 99
    } else {
      continue
    }

    const cleanedBody = cleanHardWraps(body.trim())
    sections[key] = cleanedBody
    structured.push({ key, title, filename, body: cleanedBody, order })
  }

  structured.sort((a, b) => a.order - b.order)
  return { sections, structuredSections: structured }
}

// ─── Commentary Layers ────────────────────────────────────────

export function parseCommentaryLayers(
  files: Map<string, string>,
  primaryDoc: ChamDocument,
): Record<string, OutputAnnotation[]> {
  const layers: Record<string, OutputAnnotation[]> = {}
  for (const [filename, content] of files) {
    if (!filename.endsWith('.cham.md') || filename === 'text.cham.md') continue
    const layerDoc = parse(content)
    if (layerDoc.meta.type !== 'secondary') continue
    const layerId = filename.replace('.cham.md', '')
    layers[layerId] = buildAnnotationsFromLayer(layerDoc, primaryDoc, layerId)
  }
  return layers
}

// ─── Part Building ──────────────────────────────────────────────

export function buildPartOutput(partDoc: ChamPart, pieceId: number): OutputPart {
  const verses = partDoc.textBlocks.map(b => ({ text: b.text }))
  const partNum = partDoc.meta.part
  const annotations: OutputAnnotation[] = []
  let annId = 1
  for (const section of partDoc.sections) {
    for (const entry of section.entries) {
      const range = entryToRange(entry, partDoc)
      if (!range) continue
      annotations.push({
        id: `${pieceId}.${partNum}-${annId++}`,
        range,
        kind: mapKind(entry.kind),
        lang: entry.params.lang,
        text: entry.value.trim(),
        source: 'cham',
      })
    }
  }
  return {
    num: partNum,
    group: partDoc.meta.group,
    title: partDoc.meta.title,
    source: partDoc.meta.source,
    verses,
    annotations,
    annotationText: buildAnnotationsText(partDoc, annotations) || undefined,
  }
}

// ─── Piece Building (fs-free) ─────────────────────────────────

export function buildPieceFromCham(
  chamSource: string,
  bookConfig: BookConfig,
  authors: Record<string, AuthorRecord>,
  bookId: string,
  proseFiles: Map<string, string>,
  layerFiles: Map<string, string>,
  partFiles?: Map<string, string>,
): OutputPiece | null {
  const doc = parse(chamSource)
  if (doc.meta.type !== 'primary') return null

  const pmeta = doc.meta as PrimaryMeta
  const rawVerses = doc.textBlocks.map(b => ({ text: b.text }))
  const annotations = buildAnnotations(doc, pmeta.id as number)

  // Group consecutive textBlocks into verses based on {N}...{/N} markers
  const { verses, blockToVerse, verseCharOffset } = groupBlocksIntoVerses(doc.textBlocks, doc.markers)

  // Remap annotations from block-level to verse-group-level
  const remappedAnnotations = remapAnnotationVerses(annotations, blockToVerse, verseCharOffset)
  const annText = buildAnnotationsText(doc, remappedAnnotations)

  const { sections, structuredSections } = parseProseSections(proseFiles)
  if (annText) sections['annotations'] = annText

  const partDocs = partFiles
    ? [...partFiles.entries()]
        .map(([, src]) => { const d = parse(src); return d.meta.type === 'part' ? d as import('./types.js').ChamPart : null })
        .filter(Boolean) as import('./types.js').ChamPart[]
    : []

  const rawContributors = pmeta.contributors?.length
    ? pmeta.contributors
    : bookConfig.contributors || []
  const contributors: PieceContributor[] = rawContributors.map(c => ({
    id: c.ref,
    name: authors[c.ref]?.name || c.ref,
    role: c.role,
    ...(c.title ? { title: c.title } : {}),
  }))
  const authorId = contributors[0]?.id || ''
  const authorName = contributors[0]?.name || ''
  const date = pmeta.date || bookConfig.date
  const dynastyName = authors[authorId]?.dynasty
    || date?.dynasty
    || ''

  // Build layers with remapped verse indices
  const layers = parseCommentaryLayers(layerFiles, doc)
  for (const layerId of Object.keys(layers)) {
    layers[layerId] = remapAnnotationVerses(layers[layerId], blockToVerse, verseCharOffset)
  }
  const annotationLayers = buildAnnotationLayers(layers, bookConfig)

  const parts = partDocs.length > 0
    ? partDocs.sort((a, b) => a.meta.part - b.meta.part).map(p => buildPartOutput(p, pmeta.id as number))
    : doc.parts?.map(p => buildPartOutput(p, pmeta.id as number))

  return {
    bookId,
    num: pmeta.id as number,
    title: pmeta.title,
    author: authorName,
    authorId,
    ...(contributors.length > 1 ? { contributors } : {}),
    dynasty: dynastyName,
    era: dynastyName,
    eraCode: authors[authorId]?.eraCode,
    genre: pmeta.genre || bookConfig.genre || 'poetry',
    verses,
    sections,
    annotations: remappedAnnotations,
    ...(Object.keys(layers).length > 0 ? { layers } : {}),
    ...(annotationLayers.length > 0 ? { annotationLayers } : {}),
    ...(pmeta.source ? { source: pmeta.source } : {}),
    ...(structuredSections.length > 0 ? { structuredSections } : {}),
    ...(parts?.length ? { parts } : {}),
  }
}

// ─── Book & Library ───────────────────────────────────────────

export function buildBookMeta(config: BookConfig, pieceCount: number): BookMeta {
  return {
    id: config.id,
    title: config.title,
    subtitle: config.subtitle,
    'title-en': config['title-en'],
    publisher: config.publisher,
    genre: config.genre || 'poetry',
    count: pieceCount,
    hero: config.hero,
    layers: config.layers,
    annotation: config.annotation,
  }
}

export function buildBookData(config: BookConfig, pieces: OutputPiece[]): BookData {
  return { meta: buildBookMeta(config, pieces.length), pieces }
}

export function detectScale(bookCount: number, singleBookPieceCount?: number): LibraryScale {
  if (bookCount === 0) return 'single-piece'
  if (bookCount === 1) return (singleBookPieceCount ?? 0) <= 1 ? 'single-piece' : 'single-book'
  return 'library'
}

export function buildCrossRefs(allPieces: OutputPiece[]): CrossRef[] {
  const refs: CrossRef[] = []
  for (const piece of allPieces) {
    const src = piece.source as PieceSource | undefined
    if (!src || src.relation === 'standalone') continue
    if (!src.textRef) continue
    refs.push({
      focusedBookId: piece.bookId,
      focusedNum: piece.num,
      fullBookId: src.textRef,
      fullNum: src.pieceRef,
      relation: src.relation,
    })
  }
  return refs
}

export function buildLibraryIndex(bookMetas: BookMeta[], allPieces: OutputPiece[]): LibraryIndex {
  const crossRefs = buildCrossRefs(allPieces)
  return {
    scale: detectScale(bookMetas.length),
    books: bookMetas,
    crossRefs,
  }
}

export function buildAuthorsJson(
  authors: Record<string, AuthorRecord>,
  allPieces: OutputPiece[],
): { '@id': string; '@type': string; name: string; era: string; bio: string; workCount: number }[] {
  const pieceCounts = new Map<string, number>()
  for (const p of allPieces) {
    pieceCounts.set(p.authorId, (pieceCounts.get(p.authorId) || 0) + 1)
    if (p.contributors) {
      for (const c of p.contributors) {
        if (c.id !== p.authorId) {
          pieceCounts.set(c.id, (pieceCounts.get(c.id) || 0) + 1)
        }
      }
    }
  }

  return Object.entries(authors).map(([id, data]) => ({
    '@id': `author:${encodeURIComponent(data.name)}`,
    '@type': 'Person',
    name: data.name,
    era: data.era || data.dynasty || '',
    bio: data.bio || '',
    workCount: pieceCounts.get(id) || 0,
  }))
}

export function buildDynastiesJson(allPieces: OutputPiece[]): Record<string, { '@id': string; '@type': string; name: string; authors: string[]; workCount: number }> {
  const map = new Map<string, { authors: Set<string>; count: number }>()

  for (const piece of allPieces) {
    const d = piece.era
    if (!d) continue
    if (!map.has(d)) map.set(d, { authors: new Set(), count: 0 })
    const entry = map.get(d)!
    entry.authors.add(piece.author)
    entry.count++
  }

  const result: Record<string, { '@id': string; '@type': string; name: string; authors: string[]; workCount: number }> = {}
  for (const [name, data] of map) {
    result[name] = {
      '@id': `dynasty:${encodeURIComponent(name)}`,
      '@type': 'HistoricalPeriod',
      name,
      authors: [...data.authors],
      workCount: data.count,
    }
  }
  return result
}

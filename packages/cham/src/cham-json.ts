import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'fs'
import { join, basename } from 'path'
import { parse } from './parser.js'
import { loadYaml, parseYaml } from './yaml.js'
import type {
  BookConfig, BookMeta, BookData, LibraryIndex, LibraryScale, CrossRef,
  OutputPiece, OutputAnnotation, OutputRange, OutputAnnotationLayer, OutputProseSection,
  ChamDocument, PrimaryMeta, AnnotationEntry, PieceContributor, PieceSource,
} from './types.js'

// ─── Markdown Helpers ─────────────────────────────────────────

function cleanHardWraps(text: string): string {
  return text
    .split('\n\n')
    .map(seg => seg.replace(/\n/g, ''))
    .join('\n\n')
}

function splitMdFrontmatter(content: string): {
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

// ─── PieceBuilder ─────────────────────────────────────────────

export interface AuthorRecord {
  name: string
  dynasty: string
  bio?: string
}

class PieceBuilder {
  constructor(
    private authors: Record<string, AuthorRecord>,
    private bookConfig: BookConfig,
  ) {}

  build(chamPath: string, pieceDir: string, bookId: string): OutputPiece | null {
    const src = readFileSync(chamPath, 'utf-8')
    const doc = parse(src)
    if (doc.meta.type !== 'primary') return null

    const pmeta = doc.meta as PrimaryMeta
    const verses = doc.textBlocks.map(b => ({ text: b.text }))
    const annotations = this.buildAnnotations(doc)
    const { sections, structuredSections } = this.loadProseSections(pieceDir)
    const annText = this.buildAnnotationsText(doc, annotations)
    if (annText) sections['annotations'] = annText

    const rawContributors = pmeta.contributors?.length
      ? pmeta.contributors
      : this.bookConfig.contributors || []
    const contributors: PieceContributor[] = rawContributors.map(c => ({
      id: c.ref,
      name: this.authors[c.ref]?.name || c.ref,
      role: c.role,
      ...(c.title ? { title: c.title } : {}),
    }))
    const authorId = contributors[0]?.id || ''
    const authorName = contributors[0]?.name || ''
    const dynastyName = this.authors[authorId]?.dynasty
      || pmeta.date?.dynasty
      || this.bookConfig.date?.dynasty
      || ''

    const layers = this.loadCommentaryLayers(pieceDir, doc)
    const annotationLayers = this.buildAnnotationLayers(layers)

    return {
      bookId,
      num: pmeta.id as number,
      title: pmeta.title,
      author: authorName,
      authorId,
      ...(contributors.length > 1 ? { contributors } : {}),
      dynasty: dynastyName,
      genre: pmeta.genre || this.bookConfig.genre || 'poetry',
      verses,
      sections,
      annotations,
      ...(Object.keys(layers).length > 0 ? { layers } : {}),
      ...(annotationLayers.length > 0 ? { annotationLayers } : {}),
      ...(pmeta.source ? { source: pmeta.source } : {}),
      ...(structuredSections.length > 0 ? { structuredSections } : {}),
    }
  }

  private buildAnnotations(doc: ChamDocument): OutputAnnotation[] {
    const annotations: OutputAnnotation[] = []
    let annId = 1

    for (const section of doc.sections) {
      for (const entry of section.entries) {
        const range = this.entryToRange(entry, doc)
        if (!range) continue
        annotations.push({
          id: `${(doc.meta as PrimaryMeta).id}-${annId++}`,
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

  buildAnnotationsWithDoc(
    layerDoc: ChamDocument, primaryDoc: ChamDocument, layerId: string,
  ): OutputAnnotation[] {
    const annotations: OutputAnnotation[] = []
    let annId = 1

    for (const section of layerDoc.sections) {
      for (const entry of section.entries) {
        const range = this.entryToRange(entry, primaryDoc)
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

  private entryToRange(entry: AnnotationEntry, doc: ChamDocument): OutputRange | null {
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
          end: entry.target.char,
        }
    }
  }

  private loadProseSections(pieceDir: string): {
    sections: Record<string, string>
    structuredSections: OutputProseSection[]
  } {
    const sections: Record<string, string> = {}
    const structured: OutputProseSection[] = []

    const BUILTIN: Record<string, { key: string; title: string; order: number }> = {
      'author-brief.md': { key: 'author_bio', title: '作者簡介', order: 1 },
      'background.md': { key: 'background', title: '背景資料', order: 2 },
      'analysis.md': { key: 'analysis', title: '賞析', order: 3 },
      'follow-up.md': { key: 'follow_up', title: '延伸活動', order: 4 },
      'think-questions.md': { key: 'think_questions', title: '思考問題', order: 5 },
      'preparation.md': { key: 'preparation', title: '教學準備', order: 6 },
    }

    if (!existsSync(pieceDir)) return { sections, structuredSections: structured }

    for (const filename of readdirSync(pieceDir)) {
      if (!filename.endsWith('.md') || filename.endsWith('.cham.md')) continue
      if (filename.startsWith('_')) continue

      const path = join(pieceDir, filename)
      const content = readFileSync(path, 'utf-8')
      const { frontmatter, body } = splitMdFrontmatter(content)

      const builtin = BUILTIN[filename]
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

  private loadCommentaryLayers(
    pieceDir: string, doc: ChamDocument,
  ): Record<string, OutputAnnotation[]> {
    const layers: Record<string, OutputAnnotation[]> = {}
    if (!existsSync(pieceDir)) return layers

    for (const f of readdirSync(pieceDir)) {
      if (!f.endsWith('.cham.md') || f === 'text.cham.md') continue
      const filePath = join(pieceDir, f)
      const src = readFileSync(filePath, 'utf-8')
      const layerDoc = parse(src)
      if (layerDoc.meta.type !== 'secondary') continue

      const layerId = f.replace('.cham.md', '')
      layers[layerId] = this.buildAnnotationsWithDoc(layerDoc, doc, layerId)
    }
    return layers
  }

  private buildAnnotationLayers(
    layerAnnotations: Record<string, OutputAnnotation[]>,
  ): OutputAnnotationLayer[] {
    const bookLayers = this.bookConfig.layers || []
    if (bookLayers.length === 0 && Object.keys(layerAnnotations).length === 0) return []

    const result: OutputAnnotationLayer[] = []

    result.push({
      id: 'default',
      label: this.bookConfig.annotation?.defaultLabel || '原文',
      shortLabel: this.bookConfig.annotation?.defaultShortLabel || '文',
      contributor: this.bookConfig.contributors?.[0]?.ref || '',
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

  private buildAnnotationsText(doc: ChamDocument, annotations: OutputAnnotation[]): string {
    if (!annotations.length) return ''

    const groups = new Map<string, { headword: string; pron: OutputAnnotation[]; meaning: OutputAnnotation[] }>()

    for (const ann of annotations) {
      const key = `${ann.range.scope}:${ann.range.verseIndex ?? ''}:${ann.range.start}:${ann.range.end}`
      if (!groups.has(key)) {
        groups.set(key, { headword: this.getHeadword(doc, ann), pron: [], meaning: [] })
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

  private getHeadword(doc: ChamDocument, ann: OutputAnnotation): string {
    if (ann.range.scope === 'title') {
      return (doc.meta as PrimaryMeta).title.slice(ann.range.start, ann.range.end)
    }
    if (ann.range.scope === 'verse' && ann.range.verseIndex !== undefined) {
      const block = doc.textBlocks[ann.range.verseIndex]
      if (block) return block.text.slice(ann.range.start, ann.range.end)
    }
    return ''
  }
}

// ─── Kind Mapping ─────────────────────────────────────────────

function mapKind(kind: string): string {
  if (kind === 'pron') return 'pronunciation'
  if (kind === 'meaning') return 'semantic'
  return kind
}

// ─── ChamJsonConverter ────────────────────────────────────────

export interface BookConvertOptions {
  bookDir: string
  outputDir?: string
  authors?: Record<string, AuthorRecord>
}

export interface LibraryConvertOptions {
  libraryDir: string
  outputDir: string
  authors?: Record<string, AuthorRecord>
}

export interface LibraryConvertResult {
  library: LibraryIndex
  bookData: BookData[]
  allPieces: OutputPiece[]
}

export class ChamJsonConverter {
  convertBook(opts: BookConvertOptions): BookData {
    const config = this.loadBookConfig(opts.bookDir)
    const authors = opts.authors || {}
    const builder = new PieceBuilder(authors, config)
    const pieces: OutputPiece[] = []

    for (const entry of readdirSync(opts.bookDir).sort()) {
      const pieceDir = join(opts.bookDir, entry)
      const chamPath = join(pieceDir, 'text.cham.md')
      if (!existsSync(chamPath)) continue

      const piece = builder.build(chamPath, pieceDir, config.id)
      if (piece) pieces.push(piece)
    }

    const meta: BookMeta = {
      id: config.id,
      title: config.title,
      subtitle: config.subtitle,
      titleEn: config.titleEn,
      publisher: config.publisher,
      genre: config.genre || 'poetry',
      count: pieces.length,
      hero: config.hero,
      layers: config.layers,
      annotation: config.annotation,
    }

    const bookData: BookData = { meta, pieces }

    if (opts.outputDir) {
      mkdirSync(opts.outputDir, { recursive: true })
      writeFileSync(
        join(opts.outputDir, `${config.id}.json`),
        JSON.stringify(bookData, null, 2),
        'utf-8',
      )
    }

    return bookData
  }

  convertLibrary(opts: LibraryConvertOptions): LibraryConvertResult {
    mkdirSync(opts.outputDir, { recursive: true })
    mkdirSync(join(opts.outputDir, 'books'), { recursive: true })

    const authors = opts.authors || {}
    const books = this.scanBooks(opts.libraryDir)
    const scale = this.detectScale(books, opts.libraryDir)

    const allPieces: OutputPiece[] = []
    const bookMetas: BookMeta[] = []
    const bookDataList: BookData[] = []

    for (const { config, dir } of books) {
      const bookId = config.id
      const bookOutputDir = join(opts.outputDir, 'books')
      const bookData = this.convertBook({
        bookDir: dir,
        outputDir: bookOutputDir,
        authors,
      })

      bookMetas.push(bookData.meta)
      bookDataList.push(bookData)
      allPieces.push(...bookData.pieces)
    }

    const crossRefs = this.buildCrossRefs(allPieces)
    const library: LibraryIndex = { scale, books: bookMetas, crossRefs }

    writeFileSync(
      join(opts.outputDir, 'library.json'),
      JSON.stringify(library, null, 2),
      'utf-8',
    )

    console.log(`Library: ${scale}, ${bookMetas.length} book(s), ${allPieces.length} piece(s)`)
    return { library, bookData: bookDataList, allPieces }
  }

  private loadBookConfig(bookDir: string): BookConfig {
    const raw = loadYaml(join(bookDir, 'book.yaml'))
    return {
      id: raw.id as string || basename(bookDir),
      title: raw.title as string || '',
      subtitle: raw.subtitle as string | undefined,
      titleEn: raw.titleEn as string | undefined,
      publisher: raw.publisher as string | undefined,
      genre: raw.genre as BookConfig['genre'],
      contributors: raw.contributors as BookConfig['contributors'],
      date: raw.date as BookConfig['date'],
      hero: raw.hero as string[] | undefined,
      layers: raw.layers as BookConfig['layers'],
      annotation: raw.annotation as BookConfig['annotation'],
    }
  }

  private scanBooks(libraryDir: string): { config: BookConfig; dir: string }[] {
    const books: { config: BookConfig; dir: string }[] = []
    for (const entry of readdirSync(libraryDir).sort()) {
      const dir = join(libraryDir, entry)
      if (!existsSync(join(dir, 'book.yaml'))) continue
      books.push({ config: this.loadBookConfig(dir), dir })
    }
    return books
  }

  private detectScale(books: { config: BookConfig; dir: string }[], libraryDir: string): LibraryScale {
    if (books.length === 0) return 'single-piece'
    if (books.length === 1) {
      let count = 0
      for (const entry of readdirSync(books[0].dir)) {
        if (existsSync(join(books[0].dir, entry, 'text.cham.md'))) count++
      }
      return count <= 1 ? 'single-piece' : 'single-book'
    }
    return 'library'
  }

  private buildCrossRefs(allPieces: OutputPiece[]): CrossRef[] {
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
}

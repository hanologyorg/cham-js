import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'fs'
import { join, basename } from 'path'
import { unzipSync } from 'fflate'
import type {
  BookConfig, AnnotationEntry, AnnotationKind, AnnotationTarget,
  SkqsVariant, ChamDocument, SecondaryMeta,
} from './types.js'
import { ChamSerializer } from './serializer.js'

// ─── Parsed Structures ────────────────────────────────────────

interface ParsedAnnotation {
  markerId: number
  precedingText: string  // text before this annotation (headword context)
  content: string
  hasCollation: boolean
  hasFanqie: boolean
  skqsImages: SkqsVariant[]
}

interface ParsedLine {
  type: 'header' | 'section_title' | 'body' | 'blank'
  cleanText: string
  markedText: string
  annotations: ParsedAnnotation[]
  sectionTitle?: string
}

interface ParsedSection {
  title: string
  num: number
  volumeLabel?: string
  lines: ParsedLine[]
}

interface ParsedFile {
  filename: string
  volumeLabel: string
  sections: ParsedSection[]
  headerLines: ParsedLine[]
}

// ─── XHTML Helpers ────────────────────────────────────────────

function decodeEntities(text: string): string {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
}

function extractSkqsImages(html: string): SkqsVariant[] {
  const images: SkqsVariant[] = []
  const re = /<img[^>]*resource="\.\/File:SKQSfont\.pdf"[^>]*alt="([^"]*)"[^>]*src="([^"]*)"[^>]*>/g
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) {
    images.push({ imageFile: m[2], altText: m[1] })
  }
  return images
}

function stripTags(html: string): string {
  return decodeEntities(html.replace(/<[^>]+>/g, ''))
}

function extractAnnotationText(smallHtml: string): string {
  let text = smallHtml.replace(/<span style="color:transparent;font-size:0px">[〈〉]<\/span>/g, '')
  text = text.replace(/<img[^>]*alt="([^"]*)"[^>]*>/g, '$1')
  text = stripTags(text)
  return text.trim()
}

// ─── XHTML Parser ─────────────────────────────────────────────

function extractPoemContent(xhtml: string): string {
  const m = xhtml.match(/<div class="poem"[^>]*>\s*<p>([\s\S]*?)<\/p>\s*<\/div>/)
  return m ? m[1] : ''
}

function isSectionTitleLine(line: string): string | null {
  const sectionTitleRe = /<span id="[^"]*"[^>]*><a[^>]*class="mw-selflink-fragment"[^>]*>([^<]*)<\/a><\/span>/
  const m = line.match(sectionTitleRe)
  if (!m) return null

  // Must be the only content on the line (no <small> tags or body text)
  const rest = line.replace(/<span[^>]*><a[^>]*class="mw-selflink-fragment"[^>]*>[^<]*<\/a><\/span>/, '')
  const stripped = rest.replace(/<[^>]+>/g, '').trim()
  if (stripped.length > 0) return null

  return m[1]
}

function parseXhtmlLine(line: string): ParsedLine {
  const sectionTitle = isSectionTitleLine(line)
  if (sectionTitle) {
    return {
      type: 'section_title',
      cleanText: '',
      markedText: '',
      annotations: [],
      sectionTitle,
    }
  }

  const stripped = line.replace(/<[^>]+>/g, '').trim()
  if (!stripped) {
    return { type: 'blank', cleanText: '', markedText: '', annotations: [] }
  }

  const annotations: ParsedAnnotation[] = []
  let globalMarkerId = 0
  let cleanText = ''
  let markedText = ''
  let pos = 0

  const smallMatches: Array<{ start: number; end: number; html: string }> = []
  const smallRe = /<small[^>]*>([\s\S]*?)<\/small>/g
  let sm: RegExpExecArray | null
  while ((sm = smallRe.exec(line)) !== null) {
    smallMatches.push({ start: sm.index, end: sm.index + sm[0].length, html: sm[1] })
  }

  for (const match of smallMatches) {
    const before = line.slice(pos, match.start)
    const cleanBefore = stripTags(before)

    globalMarkerId++
    const annText = extractAnnotationText(match.html)
    const skqsImages = extractSkqsImages(match.html)
    const hasCollation = /○按|○案/.test(annText)
    const hasFanqie = /[^\s〕〉」\]](反|切)/.test(annText)

    if (cleanBefore) {
      cleanText += cleanBefore
      markedText += cleanBefore
    }

    annotations.push({
      markerId: globalMarkerId,
      precedingText: cleanBefore,
      content: annText,
      hasCollation,
      hasFanqie,
      skqsImages,
    })

    markedText += `{${globalMarkerId}}`
    pos = match.end
  }

  if (pos < line.length) {
    const after = stripTags(line.slice(pos))
    if (after) {
      cleanText += after
      markedText += after
    }
  }

  const isHeader = /^[\s　]*欽定四庫全書|^[\s　]*帝範|^[\s　]*提要|^[\s　]*卷[一二三四]/.test(stripped)
    || /^[\s　]*子部|^[\s　]*儒家|^[\s　]*唐太宗/.test(stripped)

  return {
    type: isHeader ? 'header' : 'body',
    cleanText: cleanText.trim(),
    markedText: markedText.trim(),
    annotations,
  }
}

function detectImplicitTitle(text: string): string | null {
  // Detect section headers that are standalone short lines ending with 序, 提要, 跋 etc.
  const t = text.replace(/^[\s　]+/, '')
  if (t.length > 1 && t.length <= 10 && /^[^\s]+$/.test(t)) {
    if (/序$|提要$|跋$|後記$|附錄$/.test(t)) return t
  }
  return null
}

function extractTrailingTitle(text: string): string | null {
  const t = text.trim()

  // Isolate last segment after full-width space separation
  const segments = t.split(/[　\s]{2,}/)
  const lastSeg = segments[segments.length - 1]
  if (!lastSeg || lastSeg.length < 4) return null

  // Match ordinal pattern at end of segment
  const m = lastSeg.match(/^(.+)(第[一二三四五六七八九十百千萬]+)$/)
  if (!m) return null

  let prefix = m[1]
  const ordinal = m[2]

  // Split after last author attribution marker (撰, 著, 編 — standard bibliographic conventions)
  const authorSplit = prefix.match(/^(.*[撰著編註注校述譯])(.{1,4})$/)
  if (authorSplit) return authorSplit[2] + ordinal

  // No author marker — use as-is if short enough for a section name
  if (prefix.length <= 4) return prefix + ordinal

  return null
}

function parseXhtmlFile(xhtml: string, volumeLabel: string): ParsedFile {
  const content = extractPoemContent(xhtml)
  if (!content) {
    return { filename: '', volumeLabel, sections: [], headerLines: [] }
  }

  const rawLines = content.split(/<br\/?>/)
  const parsedLines = rawLines.map(l => parseXhtmlLine(l))

  const headerLines: ParsedLine[] = []
  const sections: ParsedSection[] = []
  let currentSection: ParsedSection | null = null
  let sectionNum = 0

  for (const line of parsedLines) {
    // Detect section titles from explicit spans
    if (line.type === 'section_title' && line.sectionTitle) {
      sectionNum++
      currentSection = {
        title: line.sectionTitle,
        num: sectionNum,
        volumeLabel,
        lines: [],
      }
      sections.push(currentSection)
      continue
    }

    // Detect trailing section titles on header lines (e.g., "審官第四" at end of "帝範卷二...撰審官第四")
    if (line.type === 'header') {
      const trailingTitle = extractTrailingTitle(line.cleanText)
      if (trailingTitle) {
        sectionNum++
        currentSection = {
          title: trailingTitle,
          num: sectionNum,
          volumeLabel,
          lines: [],
        }
        sections.push(currentSection)
        continue
      }
    }

    // Detect implicit section titles (e.g., "提要" standalone line)
    if (line.type === 'body' || line.type === 'header') {
      const implicitTitle = detectImplicitTitle(line.cleanText)
      if (implicitTitle) {
        sectionNum++
        currentSection = {
          title: implicitTitle,
          num: sectionNum,
          volumeLabel,
          lines: [],
        }
        sections.push(currentSection)
        continue
      }
    }

    if (line.type === 'blank') continue

    if (currentSection) {
      currentSection.lines.push(line)
    } else {
      headerLines.push(line)
    }
  }

  return { filename: '', volumeLabel, sections, headerLines }
}

// ─── CHAM Kind Mapping ────────────────────────────────────────

function annotationToKind(ann: ParsedAnnotation): AnnotationKind {
  if (ann.hasFanqie) return 'fanqie'
  if (ann.hasCollation) return 'collation'
  if (ann.skqsImages.length > 0) return 'variant'
  return 'meaning'
}

function padNum(n: number): string {
  return String(n).padStart(3, '0')
}

// ─── Main Converter ───────────────────────────────────────────

export interface EpubConvertOptions {
  epubPath?: string
  extractedDir?: string
  outputDir: string
  bookConfig: Partial<BookConfig>
  layerContributor?: string
}

export class EpubConverter {
  private serializer = new ChamSerializer()

  convert(opts: EpubConvertOptions): void {
    const workDir = opts.extractedDir || this.extractEpub(opts.epubPath!)
    if (!workDir) throw new Error('No epub path or extracted directory provided')

    const opfDir = this.findOpsDir(workDir)
    const xhtmlFiles = this.discoverXhtmlFiles(opfDir)

    const volumeMap = new Map<string, string>()
    for (const f of xhtmlFiles) {
      const vol = this.detectVolume(basename(f))
      if (vol) volumeMap.set(f, vol)
    }

    mkdirSync(opts.outputDir, { recursive: true })

    const allParsed: ParsedFile[] = []
    for (const xhtmlPath of xhtmlFiles) {
      const xhtml = readFileSync(xhtmlPath, 'utf-8')
      const volLabel = volumeMap.get(xhtmlPath) || ''
      const parsed = parseXhtmlFile(xhtml, volLabel)
      parsed.filename = basename(xhtmlPath)
      allParsed.push(parsed)
    }

    let pieceNum = 0
    const pieceDirs: string[] = []

    for (const pf of allParsed) {
      // Handle header-only files (提要, 序)
      if (pf.headerLines.length > 0 && pf.sections.length === 0) {
        pieceNum++
        const title = this.detectHeaderTitle(pf)
        const section: ParsedSection = {
          title,
          num: pieceNum,
          volumeLabel: pf.volumeLabel,
          lines: pf.headerLines,
        }
        this.writePiece(opts.outputDir, pieceNum, section, opts.bookConfig, opts.layerContributor)
        pieceDirs.push(`${padNum(pieceNum)}_${title}`)
      }

      for (const section of pf.sections) {
        pieceNum++
        this.writePiece(opts.outputDir, pieceNum, section, opts.bookConfig, opts.layerContributor)
        const safeTitle = section.title.replace(/[·\/\\]/g, '·')
        pieceDirs.push(`${padNum(pieceNum)}_${safeTitle}`)
      }
    }

    this.writeBookYaml(opts.outputDir, opts.bookConfig, pieceDirs)
    console.log(`Converted ${pieceNum} pieces to ${opts.outputDir}`)
  }

  private writePiece(
    outputDir: string, num: number, section: ParsedSection,
    bookConfig: Partial<BookConfig>, layerContributor?: string,
  ): void {
    const safeTitle = section.title.replace(/[·\/\\]/g, '·')
    const dirName = `${padNum(num)}_${safeTitle}`
    const pieceDir = join(outputDir, dirName)
    mkdirSync(pieceDir, { recursive: true })

    // text.cham.md — primary text with {N} markers
    const primaryDoc = this.buildPrimaryDoc(section, num, bookConfig)
    writeFileSync(join(pieceDir, 'text.cham.md'), this.serializer.serialize(primaryDoc), 'utf-8')

    // commentary.cham.md — secondary annotations
    if (layerContributor && section.lines.some(l => l.annotations.length > 0)) {
      const commentaryDoc = this.buildCommentaryDoc(section, layerContributor)
      writeFileSync(join(pieceDir, 'commentary.cham.md'), this.serializer.serialize(commentaryDoc), 'utf-8')
    }
  }

  private buildPrimaryDoc(
    section: ParsedSection, num: number, bookConfig: Partial<BookConfig>,
  ): ChamDocument {
    const textBlocks: ChamDocument['textBlocks'] = []
    const markers: ChamDocument['markers'] = new Map()
    let blockIdx = 0
    let globalMarkerId = 0

    for (const line of section.lines) {
      if (line.type !== 'header' && line.type !== 'body') continue

      // Build marked text: {N}precedingText{/N} interleaved with plain text
      const parts: string[] = []
      const lineAnnotations = line.annotations
      let textPos = 0
      const clean = line.cleanText

      // Track cumulative offset for marker positions
      let cumulativeText = ''

      for (const ann of lineAnnotations) {
        globalMarkerId++
        // Find where the preceding text of this annotation ends in cleanText
        // The precedingText is the text between previous annotation and this one
        const preceding = ann.precedingText

        if (preceding) {
          // The preceding text is the headword context
          // We wrap the last few chars of preceding text as the marker span
          // For simplicity, wrap the entire preceding text segment
          parts.push(preceding)
          const startOff = cumulativeText.length
          cumulativeText += preceding

          markers.set(globalMarkerId, {
            id: globalMarkerId,
            sectionIndex: 0,
            blockIndex: blockIdx,
            offset: startOff,
            length: preceding.length,
            text: preceding,
          })
          parts.push(`{${globalMarkerId}}${preceding}{/${globalMarkerId}}`)
        } else {
          // Point marker
          markers.set(globalMarkerId, {
            id: globalMarkerId,
            sectionIndex: 0,
            blockIndex: blockIdx,
            offset: cumulativeText.length,
            length: 0,
          })
          parts.push(`{${globalMarkerId}}`)
        }
      }

      textBlocks.push({
        sectionIndex: 0,
        blockIndexInSection: textBlocks.length,
        text: clean,
        display: clean,
        source: line.markedText,
      })
      blockIdx++
    }

    return {
      meta: {
        type: 'primary',
        id: num,
        title: section.title,
        contributors: bookConfig.contributors,
        date: bookConfig.date,
        genre: bookConfig.genre || 'prose',
      },
      textBlocks,
      markers,
      sections: [],
    }
  }

  private buildCommentaryDoc(section: ParsedSection, contributor: string): ChamDocument {
    const entries: AnnotationEntry[] = []
    let markerId = 0

    for (const line of section.lines) {
      for (const ann of line.annotations) {
        markerId++
        const params: Record<string, string> = {}
        if (ann.skqsImages.length > 0) {
          params.skqs = ann.skqsImages.map(s => s.altText).join(',')
        }
        entries.push({
          target: { type: 'marker', markerId },
          kind: annotationToKind(ann),
          params,
          value: ann.content,
        })
      }
    }

    return {
      meta: {
        type: 'secondary',
        base: 'text.cham.md',
        contributor,
        role: 'commentator',
        nature: 'commentary',
      },
      textBlocks: [],
      markers: new Map(),
      sections: entries.length > 0
        ? [{ name: '注釋', meta: {}, entries }]
        : [],
    }
  }

  private writeBookYaml(
    outputDir: string, config: Partial<BookConfig>, pieceDirs: string[],
  ): void {
    const lines: string[] = [
      `id: ${config.id || 'unknown'}`,
      `title: ${config.title || ''}`,
    ]
    if (config.subtitle) lines.push(`subtitle: ${config.subtitle}`)
    if (config.titleEn) lines.push(`titleEn: ${config.titleEn}`)
    if (config.publisher) lines.push(`publisher: ${config.publisher}`)
    lines.push(`genre: ${config.genre || 'prose'}`)

    if (config.contributors?.length) {
      lines.push('contributors:')
      for (const c of config.contributors) {
        lines.push(`  - ref: ${c.ref}`)
        lines.push(`    role: ${c.role}`)
      }
    }

    if (config.date) {
      lines.push('date:')
      if (config.date.dynasty) lines.push(`  dynasty: ${config.date.dynasty}`)
      if (config.date.era) lines.push(`  era: ${config.date.era}`)
      if (config.date.era_year !== undefined) lines.push(`  era_year: ${config.date.era_year}`)
    }

    if (config.layers?.length) {
      lines.push('layers:')
      for (const l of config.layers) {
        lines.push(`  - id: ${l.id}`)
        lines.push(`    label: ${l.label}`)
        lines.push(`    contributor: ${l.contributor}`)
      }
    }

    writeFileSync(join(outputDir, 'book.yaml'), lines.join('\n') + '\n', 'utf-8')
  }

  // ─── Helpers ──────────────────────────────────────────────

  private extractEpub(epubPath: string): string {
    const data = readFileSync(epubPath)
    const unzipped = unzipSync(new Uint8Array(data))
    const tmpDir = join(epubPath, '..', '.epub_extracted')
    mkdirSync(tmpDir, { recursive: true })

    for (const [fpath, content] of Object.entries(unzipped)) {
      const filePath = join(tmpDir, fpath)
      mkdirSync(join(filePath, '..'), { recursive: true })
      writeFileSync(filePath, Buffer.from(content))
    }

    return tmpDir
  }

  private findOpsDir(workDir: string): string {
    if (existsSync(join(workDir, 'OPS'))) return join(workDir, 'OPS')
    return workDir
  }

  private discoverXhtmlFiles(dir: string): string[] {
    const files: string[] = []
    for (const entry of readdirSync(dir).sort()) {
      if (entry.endsWith('.xhtml') && entry.startsWith('c')) {
        // Skip index pages (c2 is 全覽, etc.)
        if (entry.includes('quan_lan') || entry.includes('_index')) continue
        files.push(join(dir, entry))
      }
    }
    return files
  }

  private detectVolume(filename: string): string | null {
    if (filename.includes('juan1')) return '卷一'
    if (filename.includes('juan2')) return '卷二'
    if (filename.includes('juan3')) return '卷三'
    if (filename.includes('juan4')) return '卷四'
    if (filename.startsWith('c0_')) return '序'
    return null
  }

  private detectHeaderTitle(pf: ParsedFile): string {
    for (const line of pf.headerLines) {
      if (line.cleanText.includes('提要')) return '提要'
      if (line.cleanText.includes('序')) return '帝範序'
    }
    return '外序'
  }
}

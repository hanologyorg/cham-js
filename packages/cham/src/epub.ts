import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, rmSync } from 'fs'
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

// ─── Parse Context ─────────────────────────────────────────────

interface ParseContext {
  bookTitle?: string
  contributorNames?: string[]
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// ─── XHTML Parser ─────────────────────────────────────────────

function extractPoemContent(xhtml: string): string {
  const m = xhtml.match(/<div class="poem"[^>]*>\s*<p>([\s\S]*?)<\/p>\s*<\/div>/)
  return m ? m[1] : ''
}

function isPlausibleSectionTitle(title: string): boolean {
  const t = title.trim()
  if (t.length === 0 || t.length > 30) return false

  // Reject speaker markers
  if (/^[大夫文學御史賢良丞相后太后].*[曰云]$/.test(t)) return false
  if (t === '丞相' || t === '大夫' || t === '大夫不說') return false
  if (/○$/.test(t)) return false

  // Medium/long text (9-30 chars): require known structural patterns
  if (t.length > 8) {
    if (/第[一二三四五六七八九十百千萬]+$/.test(t)) return true
    if (/.+卷.+/.test(t)) return true
    if (/(?:提要|序|考證|原目|目録|音義|解|注|疏|義|章句|跋|後記|附錄|皇帝)$/.test(t)) return true
    return false
  }

  // Short text (1-8 chars): accept broadly but filter obvious body text
  if (/^[^，。；：！？]{2,4}[曰云言謂對問答]$/.test(t)) return false
  if (/^[故是以若雖然夫而又是以蓋故將]/.test(t) && /[，。；]/.test(t)) return false
  if (/[，。；：！？、]/.test(t)) return false
  return true
}

function isSectionTitleLine(line: string): string | null {
  const sectionTitleRe = /<span id="[^"]*"[^>]*><a[^>]*class="mw-selflink-fragment"[^>]*>([^<]*)<\/a><\/span>/
  const m = line.match(sectionTitleRe)
  if (!m) return null

  // Must be the only content on the line (no <small> tags or body text)
  const rest = line.replace(/<span[^>]*><a[^>]*class="mw-selflink-fragment"[^>]*>[^<]*<\/a><\/span>/, '')
  const stripped = rest.replace(/<[^>]+>/g, '').trim()
  if (stripped.length > 0) return null

  if (!isPlausibleSectionTitle(m[1])) return null

  return m[1]
}

function buildHeaderRegex(ctx: ParseContext): RegExp {
  const patterns = [
    '^[\\s　]*欽定四庫全書',
    '^[\\s　]*提要',
    '^[\\s　]*卷[一二三四五六七八九十百千萬]+',
    '^[\\s　]*子部',
    '^[\\s　]*儒家',
  ]
  if (ctx.bookTitle) patterns.push(`^[\\s　]*${escapeRegex(ctx.bookTitle)}`)
  if (ctx.contributorNames) {
    for (const name of ctx.contributorNames) {
      if (name) patterns.push(`^[\\s　]*${escapeRegex(name)}`)
    }
  }
  return new RegExp(patterns.join('|'))
}

function parseXhtmlLine(line: string, ctx: ParseContext = {}): ParsedLine {
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

  const isHeader = buildHeaderRegex(ctx).test(stripped)

  return {
    type: isHeader ? 'header' : 'body',
    cleanText: cleanText.trim(),
    markedText: markedText.trim(),
    annotations,
  }
}

function stripCommentaryNotes(text: string): string {
  return text.replace(/〈[^〉]*〉/g, '').trim()
}

function detectImplicitTitle(text: string): string | null {
  const t = text.replace(/^[\s　]+/, '')
  const bare = stripCommentaryNotes(t)

  if (bare.length < 2 || bare.length > 20) return null
  if (!/^[^\s〈〉]+$/.test(bare)) return null

  if (/序$|提要$|跋$|後記$|附錄$/.test(bare)) return bare
  if (/^.+第[一二三四五六七八九十百千萬]+$/.test(bare)) return bare
  if (/^.{2,6}[篇章]$/.test(bare) && !/卷/.test(bare)) return bare

  return null
}

function detectStandaloneTitle(text: string, hasAnnotations: boolean): string | null {
  const t = text.replace(/^[\s　]+/, '').trim()
  if (t.length < 2 || t.length > 8) return null
  if (!/^[^\s]+$/.test(t)) return null

  if (hasAnnotations && t.length <= 3) return t
  if (/[上下篇經]$/.test(t)) return t
  return null
}

function extractTrailingTitle(text: string): string | null {
  const t = stripCommentaryNotes(text.trim())

  const segments = t.split(/[　\s]{2,}/)
  let lastSeg = segments[segments.length - 1]
  if (!lastSeg || lastSeg.length < 2) return null

  if (lastSeg.length > 8) {
    const parts = lastSeg.split(/[　]/)
    for (let i = parts.length - 1; i >= 1; i--) {
      const candidate = parts.slice(i).join('　')
      if (candidate.length >= 2 && candidate.length <= 8) {
        lastSeg = candidate
        break
      }
    }
  }

  const m = lastSeg.match(/^(.+)(第[一二三四五六七八九十百千萬]+)$/)
  if (m) {
    let prefix = m[1]
    const ordinal = m[2]

    const authorSplit = prefix.match(/^(.*[撰著編註注校述譯定])(.{1,4})$/)
    if (authorSplit) return authorSplit[2] + ordinal
    if (prefix.length <= 4) return prefix + ordinal

    return null
  }

  if (lastSeg.length <= 8 && /[上下篇章經]$/.test(lastSeg)) {
    const stripped = lastSeg.replace(/^[撰著編註注校述譯定]/, '')
    if (stripped.length >= 2 && stripped.length <= 6) return stripped
  }

  return null
}

function parseXhtmlFile(xhtml: string, volumeLabel: string, ctx: ParseContext = {}): ParsedFile {
  const content = extractPoemContent(xhtml)
  if (!content) {
    return { filename: '', volumeLabel, sections: [], headerLines: [] }
  }

  const rawLines = content.split(/<br\/?>/)
  const parsedLines = rawLines.map(l => parseXhtmlLine(l, ctx))

  const headerLines: ParsedLine[] = []
  const sections: ParsedSection[] = []
  let currentSection: ParsedSection | null = null
  let sectionNum = 0

  let pastToc = false

  for (const line of parsedLines) {
    // Detect TOC boundary — skip all section detection after this point
    const tocCheck = line.type === 'section_title' ? (line.sectionTitle ?? line.cleanText) : line.cleanText
    if (tocCheck && /(?:原目|目[錄録录])$/.test(tocCheck.trim())) {
      pastToc = true
      continue
    }

    // Skip all section title detection when inside TOC
    if (pastToc) {
      if (line.type === 'section_title') continue
      if (line.type === 'blank') continue
      if (currentSection) {
        currentSection.lines.push(line)
      } else {
        headerLines.push(line)
      }
      continue
    }

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

    // Detect trailing section titles (e.g., "審官第四" at end of "帝範卷二...撰審官第四")
    if (line.type === 'header' || line.type === 'body') {
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

    // Detect standalone short titles on body lines (e.g., "大道下", "持樞")
    if (line.type === 'body') {
      const standaloneTitle = detectStandaloneTitle(line.cleanText, line.annotations.length > 0)
      if (standaloneTitle) {
        sectionNum++
        currentSection = {
          title: standaloneTitle,
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
  private bookTitle = ''

  convert(opts: EpubConvertOptions): void {
    const workDir = opts.extractedDir || this.extractEpub(opts.epubPath!)
    if (!workDir) throw new Error('No epub path or extracted directory provided')

    this.bookTitle = opts.bookConfig.title || ''

    const ctx: ParseContext = {
      bookTitle: this.bookTitle,
      contributorNames: opts.bookConfig.contributors?.map(c => c.ref),
    }

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
      const parsed = parseXhtmlFile(xhtml, volLabel, ctx)
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
    const epubBasename = basename(epubPath, '.epub')
    const tmpDir = join(epubPath, '..', `.epub_extracted_${epubBasename}`)
    if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true })
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
    const skipPatterns = ['quan_lan', '_index', 'about', 'nav', 'title', 'toc']
    for (const entry of readdirSync(dir)) {
      if (!entry.endsWith('.xhtml')) continue
      if (skipPatterns.some(p => entry.includes(p))) continue
      if (entry.startsWith('c')) {
        files.push(join(dir, entry))
      }
    }
    // Sort numerically by the number after 'c' prefix
    files.sort((a, b) => {
      const numA = parseInt(basename(a).match(/^c(\d+)/)?.[1] || '0', 10)
      const numB = parseInt(basename(b).match(/^c(\d+)/)?.[1] || '0', 10)
      return numA - numB
    })
    // Fallback: if no c-prefixed files found, include all non-metadata xhtml
    if (files.length === 0) {
      for (const entry of readdirSync(dir).sort()) {
        if (!entry.endsWith('.xhtml')) continue
        if (skipPatterns.some(p => entry.includes(p))) continue
        files.push(join(dir, entry))
      }
    }
    return files
  }

  private detectVolume(filename: string): string | null {
    if (filename.startsWith('c0_')) return '序'
    const m = filename.match(/juan(\d+)/)
    if (m) return '卷' + this.numToChinese(parseInt(m[1], 10))
    return null
  }

  private numToChinese(n: number): string {
    const digits = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九']
    if (n <= 0) return ''
    if (n < 10) return digits[n]
    if (n < 20) return '十' + (n % 10 ? digits[n % 10] : '')
    if (n < 100) return digits[Math.floor(n / 10)] + '十' + (n % 10 ? digits[n % 10] : '')
    return String(n)
  }

  private detectHeaderTitle(pf: ParsedFile): string {
    for (const line of pf.headerLines) {
      const t = line.cleanText.trim()
      if (t.length <= 10 && t.includes('提要')) return '提要'
      if (t.length <= 10 && t.includes('序')) return this.bookTitle ? `${this.bookTitle}序` : '序'
      if (/^提要/.test(t)) return '提要'
      if (/^序/.test(t)) return this.bookTitle ? `${this.bookTitle}序` : '序'
    }
    if (pf.volumeLabel) return pf.volumeLabel
    return '外序'
  }
}

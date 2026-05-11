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

// A single sub-annotation extracted from a packed SKQS annotation
interface SplitEntry {
  kind: AnnotationKind
  headword?: string
  value: string
  params?: Record<string, string>
}

const CNI_RE = /[，。；：！？、]/
const SKQS_COLLATION_RE = /○按|○案|○/

function classifyAnnotationContent(content: string, hasSkqsImages: boolean): AnnotationKind {
  if (hasSkqsImages) return 'variant'
  if (SKQS_COLLATION_RE.test(content) && content.length < 30) return 'collation'
  return 'meaning'
}

// Check if content is a dense sound string (packed fanqie/zhiyin entries)
function isDenseSoundString(content: string): boolean {
  // Dense strings have multiple 音 or 切 markers without narrative structure
  const soundMarkers = (content.match(/[音切]/g) || []).length
  const cniPunct = (content.match(CNI_RE) || []).length
  return soundMarkers >= 2 && cniPunct === 0 && content.length > 10
}

// Parse a dense string of fanqie/zhiyin entries (mengzi-zhushu format)
// e.g. "宓音伏羲音戲齕恨沒切釁許覲切舍音捨"
function parseDenseSoundString(text: string): SplitEntry[] {
  const entries: SplitEntry[] = []
  let pos = 0

  while (pos < text.length) {
    const rem = text.slice(pos)

    // Fanqie: target(1) + upper(1) + lower(1) + 切
    const fq = rem.match(/^([㐀-鿿])([㐀-鿿])([㐀-鿿])切/)
    if (fq) {
      entries.push({ kind: 'fanqie', headword: fq[1], value: `${fq[2]}${fq[3]}切`, params: { upper: fq[2], lower: fq[3] } })
      pos += fq[0].length
      continue
    }

    // Fanqie variant: target(1) + upper/lower(1) + 反
    const fan = rem.match(/^([㐀-鿿])([㐀-鿿])反/)
    if (fan) {
      entries.push({ kind: 'fanqie', headword: fan[1], value: `${fan[2]}反`, params: { upper: fan[2] } })
      pos += fan[0].length
      continue
    }

    // Zhiyin: target + 音 + homophone (headword and homophone are always 1 char)
    const zy = rem.match(/^([㐀-鿿])音([㐀-鿿])(?=[㐀-鿿音切反聲○同]|$)/)
    if (zy) {
      entries.push({ kind: 'zhiyin', headword: zy[1], value: zy[2] })
      pos += zy[0].length
      continue
    }

    // Tone: target + [上去平入]聲
    const tn = rem.match(/^([㐀-鿿])([上去平入]聲)/)
    if (tn) {
      entries.push({ kind: 'tone', headword: tn[1], value: tn[2] })
      pos += tn[0].length
      continue
    }

    // Variant/同 marker
    const vr = rem.match(/^([㐀-鿿])同/)
    if (vr) {
      entries.push({ kind: 'variant', headword: vr[1], value: '同' })
      pos += vr[0].length
      continue
    }

    // Skip common context markers that aren't annotation entries
    if (rem.startsWith('如字')) { pos += 2; continue }
    if (rem.startsWith('下同') || rem.startsWith('皆同')) { pos += 2; continue }
    if (rem.match(/^[丁張趙陸孔劉]云?/)) {
      // Scholar attribution — skip to next recognizable entry
      const skip = rem.match(/^[丁張趙陸孔劉]云?[，。；：]?/)
      if (skip) { pos += skip[0].length; continue }
    }

    // Unknown — skip one char
    pos++
  }

  return entries
}

// Split a tab-separated trailing note into sub-entries
// e.g. "緹音提恣肆也" → [zhiyin(緹→提), meaning(恣→肆也)]
// e.g. "處上聲" → [tone(處, 上聲)]
// e.g. "適音嫡○按注漢紀當作史記" → [zhiyin(適→嫡), collation(按注...)]
function splitTrailingNote(text: string): SplitEntry[] {
  const entries: SplitEntry[] = []
  let remaining = text.trim()

  // Extract collation sections (○...)
  if (remaining.includes('○')) {
    const parts = remaining.split('○')
    // Text before ○
    if (parts[0].trim()) {
      entries.push(...splitPhoneticNote(parts[0].trim()))
    }
    // Each ○ section is collation
    for (let i = 1; i < parts.length; i++) {
      const collText = parts[i].trim()
      if (collText) {
        entries.push({ kind: 'collation', value: collText })
      }
    }
    return entries
  }

  return splitPhoneticNote(remaining)
}

// Split a phonetic note that may contain multiple entries without separators
// e.g. "緹音提恣肆也" or "餤音淡殞䘮也"
function splitPhoneticNote(text: string): SplitEntry[] {
  const entries: SplitEntry[] = []

  // Try zhiyin: X音Y at start (headword and homophone are always exactly 1 character)
  const zy = text.match(/^([㐀-鿿])音([㐀-鿿])/)
  if (zy) {
    entries.push({ kind: 'zhiyin', headword: zy[1], value: zy[2] })
    const rest = text.slice(zy[0].length)
    if (rest.trim()) {
      const r = rest.trim()
      entries.push({ kind: 'meaning', headword: r[0], value: r })
    }
    return entries
  }

  // Try tone: X[上去平入]聲
  const tn = text.match(/^([㐀-鿿])([上去平入]聲)(.*)$/)
  if (tn) {
    entries.push({ kind: 'tone', headword: tn[1], value: tn[2] })
    const rest = (tn[3] || '').trim()
    if (rest) {
      entries.push({ kind: 'meaning', value: rest })
    }
    return entries
  }

  // Try fanqie: X[AB]切 or X[AB]反
  const fq = text.match(/^([㐀-鿿])([㐀-鿿])([㐀-鿿])([切反])(.*)$/)
  if (fq) {
    entries.push({ kind: 'fanqie', headword: fq[1], value: `${fq[2]}${fq[3]}${fq[4]}`, params: { upper: fq[2], lower: fq[3] } })
    const rest = (fq[5] || '').trim()
    if (rest) {
      entries.push({ kind: 'meaning', value: rest })
    }
    return entries
  }

  // Fallback: single meaning entry
  if (text) {
    entries.push({ kind: 'meaning', value: text })
  }
  return entries
}

// Main annotation content splitter
function splitAnnotationContent(content: string, hasSkqsImages: boolean, hasFanqie: boolean): SplitEntry[] {
  // Pure variant annotation — don't split
  if (hasSkqsImages) {
    return [{ kind: 'variant', value: content }]
  }

  // Empty or punctuation-only — skip
  if (/^[○◎・\s]+$/.test(content)) {
    return []
  }

  // Dense sound string (many fanqie/zhiyin packed together)
  if (hasFanqie && isDenseSoundString(content)) {
    const parsed = parseDenseSoundString(content)
    if (parsed.length > 0) return parsed
  }

  // Collation-only annotation
  if (/^○/.test(content) && !content.includes('　')) {
    return [{ kind: 'collation', value: content.replace(/^○/, '').trim() || content }]
  }

  // Split on full-width space (　) — main commentary + trailing notes
  if (content.includes('　')) {
    const segments = content.split('　')
    const entries: SplitEntry[] = []

    // First segment is the main commentary
    const main = segments[0].trim()
    if (main) {
      entries.push({ kind: 'meaning', value: main })
    }

    // Subsequent segments are trailing phonetic/meaning notes
    for (let i = 1; i < segments.length; i++) {
      const seg = segments[i].trim()
      if (!seg) continue
      entries.push(...splitTrailingNote(seg))
    }
    return entries
  }

  // Single-segment annotation with embedded 音 — try inline extraction
  if (hasFanqie && content.length > 10) {
    // Check for embedded X音Y patterns within longer meaning text
    // Only extract if the sound note is clearly at the end or embedded with a clear boundary
    const inlineSound = content.match(/^(.+?)　?([㐀-鿿])音([㐀-鿿])(.*?)$/)
    if (inlineSound && inlineSound[1].length > 5) {
      const entries: SplitEntry[] = []
      entries.push({ kind: 'meaning', value: inlineSound[1].trim() })
      entries.push({ kind: 'zhiyin', headword: inlineSound[2], value: inlineSound[3] })
      if (inlineSound[4] && inlineSound[4].trim()) {
        entries.push({ kind: 'meaning', value: inlineSound[4].trim() })
      }
      return entries
    }
  }

  // Default: check if content is a standalone phonetic annotation
  let kind: AnnotationKind = 'meaning'
  if (/^[㐀-鿿][㐀-鿿][㐀-鿿][切反]$/.test(content)) {
    const fqMatch = content.match(/^([㐀-鿿])([㐀-鿿])([㐀-鿿])([切反])$/)!
    return [{ kind: 'fanqie', headword: fqMatch[1], value: `${fqMatch[2]}${fqMatch[3]}${fqMatch[4]}`, params: { upper: fqMatch[2], lower: fqMatch[3] } }]
  }
  if (/^[㐀-鿿]音[㐀-鿿]$/.test(content)) {
    const zyMatch = content.match(/^([㐀-鿿])音([㐀-鿿])$/)!
    return [{ kind: 'zhiyin', headword: zyMatch[1], value: zyMatch[2] }]
  }
  if (/^[㐀-鿿][上去平入]聲$/.test(content)) {
    const tnMatch = content.match(/^([㐀-鿿])([上去平入]聲)$/)!
    return [{ kind: 'tone', headword: tnMatch[1], value: tnMatch[2] }]
  }
  return [{ kind, value: content }]
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
        const baseParams: Record<string, string> = {}
        if (ann.skqsImages.length > 0) {
          baseParams.skqs = ann.skqsImages.map(s => s.altText).join(',')
        }

        const split = splitAnnotationContent(ann.content, ann.skqsImages.length > 0, ann.hasFanqie)

        if (split.length === 0) continue

        if (split.length === 1) {
          // Single entry — use as before but with proper kind
          const s = split[0]
          entries.push({
            target: { type: 'marker', markerId },
            kind: s.kind,
            params: { ...baseParams, ...s.params },
            headword: s.headword,
            value: s.value,
          })
        } else {
          // Multiple entries — first gets the marker, rest share it
          // (headword field identifies the target character for each)
          for (let i = 0; i < split.length; i++) {
            const s = split[i]
            entries.push({
              target: { type: 'marker', markerId },
              kind: s.kind,
              params: { ...baseParams, ...s.params },
              headword: s.headword,
              value: s.value,
            })
          }
        }
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

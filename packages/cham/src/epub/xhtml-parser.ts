// ─── XHTML Parser ─────────────────────────────────────────────
// Parses an extracted ePub XHTML file into a structured ParsedFile:
// header lines + sections (each with title + body lines). Annotations
// inside `<small>` spans are extracted into ParsedAnnotation records.
//
// The output is consumed by EpubConverter, which assembles CHAM
// documents from parsed lines and annotations.

import type { SkqsVariant } from '../types.js'
import {
  stripTags, extractAnnotationText, extractSkqsImages, escapeRegex,
} from './utils.js'

// ─── Types ─────────────────────────────────────────────────────

export interface ParsedAnnotation {
  markerId: number
  /** Text before this annotation — headword context. */
  precedingText: string
  content: string
  hasCollation: boolean
  hasFanqie: boolean
  skqsImages: SkqsVariant[]
}

export interface ParsedLine {
  type: 'header' | 'section_title' | 'body' | 'blank'
  cleanText: string
  markedText: string
  annotations: ParsedAnnotation[]
  sectionTitle?: string
}

export interface ParsedSection {
  title: string
  num: number
  volumeLabel?: string
  lines: ParsedLine[]
}

export interface ParsedFile {
  filename: string
  volumeLabel: string
  sections: ParsedSection[]
  headerLines: ParsedLine[]
}

export interface ParseContext {
  bookTitle?: string
  contributorNames?: string[]
}

// ─── Helpers ───────────────────────────────────────────────────

function extractPoemContent(xhtml: string): string {
  const m = xhtml.match(/<div class="poem"[^>]*>\s*<p>([\s\S]*?)<\/p>\s*<\/div>/)
  return m ? m[1] : ''
}

function isPlausibleSectionTitle(title: string): boolean {
  const t = title.trim()
  if (t.length === 0 || t.length > 30) return false

  if (/^[大夫文學御史賢良丞相后太后].*[曰云]$/.test(t)) return false
  if (t === '丞相' || t === '大夫' || t === '大夫不說') return false
  if (/○$/.test(t)) return false

  if (t.length > 8) {
    if (/第[一二三四五六七八九十百千萬]+$/.test(t)) return true
    if (/.+卷.+/.test(t)) return true
    if (/(?:提要|序|考證|原目|目録|音義|解|注|疏|義|章句|跋|後記|附錄|皇帝)$/.test(t)) return true
    return false
  }

  if (/^[^，。；：！？]{2,4}[曰云言謂對問答]$/.test(t)) return false
  if (/^[故是以若雖然夫而又是以蓋故將]/.test(t) && /[，。；]/.test(t)) return false
  if (/[，。；：！？、]/.test(t)) return false
  return true
}

function isSectionTitleLine(line: string): string | null {
  const sectionTitleRe = /<span id="[^"]*"[^>]*><a[^>]*class="mw-selflink-fragment"[^>]*>([^<]*)<\/a><\/span>/
  const m = line.match(sectionTitleRe)
  if (!m) return null

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
    const prefix = m[1]
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

// ─── Line Parser ───────────────────────────────────────────────

export function parseXhtmlLine(line: string, ctx: ParseContext = {}): ParsedLine {
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

// ─── File Parser ───────────────────────────────────────────────

export function parseXhtmlFile(xhtml: string, volumeLabel: string, ctx: ParseContext = {}): ParsedFile {
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
    const tocCheck = line.type === 'section_title' ? (line.sectionTitle ?? line.cleanText) : line.cleanText
    if (tocCheck && /(?:原目|目[錄録录])$/.test(tocCheck.trim())) {
      pastToc = true
      continue
    }

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
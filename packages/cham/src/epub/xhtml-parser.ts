// ─── XHTML Parser ─────────────────────────────────────────────
// Parses an extracted ePub XHTML file into a structured ParsedFile:
// header lines + sections (each with title + body lines). Annotations
// inside `<small>` spans are extracted into ParsedAnnotation records.
//
// The output is consumed by EpubConverter, which assembles CHAM
// documents from parsed lines and annotations.
//
// Title detection heuristics live in title-detector.ts; this module
// handles only line-level parsing and file-level assembly.

import type { SkqsVariant } from '../types.js'
import {
  stripTags, extractAnnotationText, extractSkqsImages,
} from './utils.js'
import {
  detectSectionTitleLine, detectImplicitTitle, detectStandaloneTitle,
  extractTrailingTitle, buildHeaderRegex,
} from './title-detector.js'

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

// ─── Line Parser ───────────────────────────────────────────────

export function parseXhtmlLine(line: string, ctx: ParseContext = {}): ParsedLine {
  const sectionTitle = detectSectionTitleLine(line)
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
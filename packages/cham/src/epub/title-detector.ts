// ─── Section Title Detection ───────────────────────────────────
// Heuristics for detecting section titles in SKQS ePub XHTML content.
// Separated from xhtml-parser.ts because title detection is a
// distinct concern with its own testing and evolution path.
//
// Title detection in classical Chinese texts is inherently fuzzy:
// there's no explicit markup — we infer from length, character
// patterns, and positional context. These functions encode the
// rules that have been calibrated against the Wikisource SKQS corpus.

import { escapeRegex } from './utils.js'

/**
 * Strips commentary note markers `〈...〉` from text.
 */
function stripCommentaryNotes(text: string): string {
  return text.replace(/〈[^〉]*〉/g, '').trim()
}

/**
 * Decides whether a string is a plausible section title.
 *
 * Used to filter out false positives from mw-selflink-fragment anchors:
 * not every link is a section title (some are inline cross-references).
 *
 * Calibrated against the Wikisource SKQS corpus: accepts titles that
 * match classical Chinese section-naming patterns, rejects dialogue
 * cues and sentence fragments.
 */
export function isPlausibleSectionTitle(title: string): boolean {
  const t = title.trim()
  if (t.length === 0 || t.length > 30) return false

  // Reject dialogue cues (e.g., "大夫曰", "文學云")
  if (/^[大夫文學御史賢良丞相后太后].*[曰云]$/.test(t)) return false
  if (t === '丞相' || t === '大夫' || t === '大夫不說') return false
  if (/○$/.test(t)) return false

  // Long titles: accept only if they end in a known section-word
  if (t.length > 8) {
    if (/第[一二三四五六七八九十百千萬]+$/.test(t)) return true
    if (/.+卷.+/.test(t)) return true
    if (/(?:提要|序|考證|原目|目録|音義|解|注|疏|義|章句|跋|後記|附錄|皇帝)$/.test(t)) return true
    return false
  }

  // Short titles: reject anything that looks like a sentence fragment
  if (/^[^，。；：！？]{2,4}[曰云言謂對問答]$/.test(t)) return false
  if (/^[故是以若雖然夫而又是以蓋故將]/.test(t) && /[，。；]/.test(t)) return false
  if (/[，。；：！？、]/.test(t)) return false
  return true
}

/**
 * Detects a section title from a mw-selflink-fragment anchor line.
 * Returns the title text if the line is a section header, null otherwise.
 */
export function detectSectionTitleLine(line: string): string | null {
  const sectionTitleRe = /<span id="[^"]*"[^>]*><a[^>]*class="mw-selflink-fragment"[^>]*>([^<]*)<\/a><\/span>/
  const m = line.match(sectionTitleRe)
  if (!m) return null

  const rest = line.replace(/<span[^>]*><a[^>]*class="mw-selflink-fragment"[^>]*>[^<]*<\/a><\/span>/, '')
  const stripped = rest.replace(/<[^>]+>/g, '').trim()
  if (stripped.length > 0) return null

  if (!isPlausibleSectionTitle(m[1])) return null
  return m[1]
}

/**
 * Detects an "implicit" title — a bare line that looks like a title
 * even without explicit markup. Used for lines like "序", "提要",
 * "學而第一", etc.
 */
export function detectImplicitTitle(text: string): string | null {
  const t = text.replace(/^[\s　]+/, '')
  const bare = stripCommentaryNotes(t)

  if (bare.length < 2 || bare.length > 20) return null
  if (!/^[^\s〈〉]+$/.test(bare)) return null

  if (/序$|提要$|跋$|後記$|附錄$/.test(bare)) return bare
  if (/^.+第[一二三四五六七八九十百千萬]+$/.test(bare)) return bare
  if (/^.{2,6}[篇章]$/.test(bare) && !/卷/.test(bare)) return bare

  return null
}

/**
 * Detects a standalone title — a very short bare line that is
 * likely a title when contextual cues (e.g., has annotations) match.
 */
export function detectStandaloneTitle(text: string, hasAnnotations: boolean): string | null {
  const t = text.replace(/^[\s　]+/, '').trim()
  if (t.length < 2 || t.length > 8) return null
  if (!/^[^\s]+$/.test(t)) return null

  if (hasAnnotations && t.length <= 3) return t
  if (/[上下篇經]$/.test(t)) return t
  return null
}

/**
 * Extracts a title from the trailing segment of a line — used when
 * a body line ends with what looks like a section label.
 *
 * Strips author attribution prefixes (撰/著/編/註/注/校/述/譯/定)
 * from the candidate title.
 */
export function extractTrailingTitle(text: string): string | null {
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

/**
 * Builds a regex that matches "header" lines — the boilerplate lines
 * that appear at the top of SKQS volumes (欽定四庫全書, 提要, 卷...).
 */
export function buildHeaderRegex(ctx: { bookTitle?: string; contributorNames?: readonly string[] }): RegExp {
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
      patterns.push(`^[\\s　]*${escapeRegex(name)}注`)
    }
  }
  return new RegExp(patterns.join('|'))
}

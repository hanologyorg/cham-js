// ─── Volume Detection ──────────────────────────────────────────
// Infers volume labels (序, 卷一, 卷二, ...) from ePub XHTML filenames
// and header content. Used by EpubConverter to name output pieces.

import type { ParsedFile } from './xhtml-parser.js'

const NUMERALS = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九']

/**
 * Converts an integer to Chinese numeral (1–99 supported).
 * Returns the empty string for non-positive input, and falls back
 * to Arabic numerals for values ≥100.
 */
export function numToChinese(n: number): string {
  if (n <= 0) return ''
  if (n < 10) return NUMERALS[n]
  if (n < 20) return '十' + (n % 10 ? NUMERALS[n % 10] : '')
  if (n < 100) return NUMERALS[Math.floor(n / 10)] + '十' + (n % 10 ? NUMERALS[n % 10] : '')
  return String(n)
}

/**
 * Detects the volume label from a XHTML filename.
 *
 * Conventions:
 *   c0_*  → 序
 *   cN_* or *juanN* → 卷<chinese-numeral>
 */
export function detectVolumeFromFilename(filename: string): string | null {
  if (filename.startsWith('c0_')) return '序'
  const m = filename.match(/juan(\d+)/)
  if (m) return '卷' + numToChinese(parseInt(m[1], 10))
  return null
}

/**
 * Detects a piece title from the header lines of a parsed ePub file.
 *
 * Looks for explicit 提要 or 序 markers in the header; falls back
 * to the volume label if no header title is found.
 */
export function detectHeaderTitle(pf: ParsedFile, bookTitle: string): string {
  for (const line of pf.headerLines) {
    const t = line.cleanText.trim()
    if (t.length <= 10 && t.includes('提要')) return '提要'
    if (t.length <= 10 && t.includes('序')) return bookTitle ? `${bookTitle}序` : '序'
    if (/^提要/.test(t)) return '提要'
    if (/^序/.test(t)) return bookTitle ? `${bookTitle}序` : '序'
  }
  if (pf.volumeLabel) return pf.volumeLabel
  return bookTitle || '未知'
}

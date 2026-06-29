// ─── Annotation Splitter ──────────────────────────────────────
// Splits packed SKQS annotation content into typed SplitEntry records.
// A single `<small>` annotation often packs multiple kinds:
//   "緹音提恣肆也"   → [zhiyin(緹→提), meaning(恣→肆也)]
//   "適音嫡○按注漢紀當作史記" → [zhiyin(適→嫡), collation(按注...)]
//   "宓音伏羲音戲齕恨沒切釁許覲切" → [fanqie ×2, zhiyin ×2, ...]
//
// Output drives the commentary-document builder in EpubConverter.

import type { AnnotationKind } from '../types.js'

export interface SplitEntry {
  kind: AnnotationKind
  headword?: string
  value: string
  params?: Record<string, string>
}

const CNI_RE = /[，。；：！？、]/
const SKQS_COLLATION_RE = /○按|○案|○/

export function classifyAnnotationContent(content: string, hasSkqsImages: boolean): AnnotationKind {
  if (hasSkqsImages) return 'variant'
  if (SKQS_COLLATION_RE.test(content) && content.length < 30) return 'collation'
  return 'meaning'
}

/** Dense sound strings pack many fanqie/zhiyin entries without punctuation. */
export function isDenseSoundString(content: string): boolean {
  const soundMarkers = (content.match(/[音切]/g) || []).length
  const cniPunct = (content.match(CNI_RE) || []).length
  return soundMarkers >= 2 && cniPunct === 0 && content.length > 10
}

/** Parse "宓音伏羲音戲齕恨沒切釁許覲切舍音捨" into individual entries. */
export function parseDenseSoundString(text: string): SplitEntry[] {
  const entries: SplitEntry[] = []
  let pos = 0

  while (pos < text.length) {
    const rem = text.slice(pos)

    const fq = rem.match(/^([㐀-鿿])([㐀-鿿])([㐀-鿿])切/)
    if (fq) {
      entries.push({ kind: 'fanqie', headword: fq[1], value: `${fq[2]}${fq[3]}切`, params: { upper: fq[2], lower: fq[3] } })
      pos += fq[0].length
      continue
    }

    const fan = rem.match(/^([㐀-鿿])([㐀-鿿])反/)
    if (fan) {
      entries.push({ kind: 'fanqie', headword: fan[1], value: `${fan[2]}反`, params: { upper: fan[2] } })
      pos += fan[0].length
      continue
    }

    const zy = rem.match(/^([㐀-鿿])音([㐀-鿿])(?=[㐀-鿿音切反聲○同]|$)/)
    if (zy) {
      entries.push({ kind: 'zhiyin', headword: zy[1], value: zy[2] })
      pos += zy[0].length
      continue
    }

    const tn = rem.match(/^([㐀-鿿])([上去平入]聲)/)
    if (tn) {
      entries.push({ kind: 'tone', headword: tn[1], value: tn[2] })
      pos += tn[0].length
      continue
    }

    const vr = rem.match(/^([㐀-鿿])同/)
    if (vr) {
      entries.push({ kind: 'variant', headword: vr[1], value: '同' })
      pos += vr[0].length
      continue
    }

    if (rem.startsWith('如字')) { pos += 2; continue }
    if (rem.startsWith('下同') || rem.startsWith('皆同')) { pos += 2; continue }
    if (rem.match(/^[丁張趙陸孔劉]云?/)) {
      const skip = rem.match(/^[丁張趙陸孔劉]云?[，。；：]?/)
      if (skip) { pos += skip[0].length; continue }
    }

    pos++
  }

  return entries
}

/** Split a trailing note at ○ boundaries into phonetic + collation entries. */
export function splitTrailingNote(text: string): SplitEntry[] {
  const entries: SplitEntry[] = []
  const remaining = text.trim()

  if (remaining.includes('○')) {
    const parts = remaining.split('○')
    if (parts[0].trim()) {
      entries.push(...splitPhoneticNote(parts[0].trim()))
    }
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

/** Split a single phonetic note that may contain a headword + homophone + meaning. */
export function splitPhoneticNote(text: string): SplitEntry[] {
  const entries: SplitEntry[] = []

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

  const tn = text.match(/^([㐀-鿿])([上去平入]聲)(.*)$/)
  if (tn) {
    entries.push({ kind: 'tone', headword: tn[1], value: tn[2] })
    const rest = (tn[3] || '').trim()
    if (rest) {
      entries.push({ kind: 'meaning', value: rest })
    }
    return entries
  }

  const fq = text.match(/^([㐀-鿿])([㐀-鿿])([㐀-鿿])([切反])(.*)$/)
  if (fq) {
    entries.push({ kind: 'fanqie', headword: fq[1], value: `${fq[2]}${fq[3]}${fq[4]}`, params: { upper: fq[2], lower: fq[3] } })
    const rest = (fq[5] || '').trim()
    if (rest) {
      entries.push({ kind: 'meaning', value: rest })
    }
    return entries
  }

  if (text) {
    entries.push({ kind: 'meaning', value: text })
  }
  return entries
}

/** Main entry point: split an annotation's content into typed sub-entries. */
export function splitAnnotationContent(content: string, hasSkqsImages: boolean, hasFanqie: boolean): SplitEntry[] {
  if (hasSkqsImages) {
    return [{ kind: 'variant', value: content }]
  }

  if (/^[○◎・\s]+$/.test(content)) {
    return []
  }

  if (hasFanqie && isDenseSoundString(content)) {
    const parsed = parseDenseSoundString(content)
    if (parsed.length > 0) return parsed
  }

  if (/^○/.test(content) && !content.includes('　')) {
    return [{ kind: 'collation', value: content.replace(/^○/, '').trim() || content }]
  }

  if (content.includes('　')) {
    const segments = content.split('　')
    const entries: SplitEntry[] = []

    const main = segments[0].trim()
    if (main) {
      entries.push({ kind: 'meaning', value: main })
    }

    for (let i = 1; i < segments.length; i++) {
      const seg = segments[i].trim()
      if (!seg) continue
      entries.push(...splitTrailingNote(seg))
    }
    return entries
  }

  if (hasFanqie && content.length > 10) {
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
  return [{ kind: 'meaning', value: content }]
}
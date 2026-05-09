import type { Annotation, AnnotationEntry, PronSegment } from '../types'
import { toChineseNumber } from './chineseNumber'

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export function parsePronSegments(def: string): { segments: PronSegment[], remaining: string } {
  const parts = def.split('○').filter(s => s.trim())
  if (!parts.length) return { segments: [], remaining: '' }

  const segments: PronSegment[] = []
  const remaining: string[] = []

  for (const raw of parts) {
    const s = raw.replace(/[；;]/g, ' ').trim()
    if (s.startsWith('粵')) {
      segments.push({ lang: 'yue', label: '粵', parts: s.slice(1).trim().split(/\s+/).filter(Boolean) })
    } else if (s.startsWith('漢')) {
      segments.push({ lang: 'cmn', label: '普', parts: s.slice(1).trim().split(/\s+/).filter(Boolean) })
    } else {
      remaining.push(s)
    }
  }

  return { segments, remaining: remaining.join('\n').trim() }
}

export function parseAnnotationBlock(raw: string): AnnotationEntry[] {
  const parts = raw.split(/(\d{1,2})\.\s*/)
  const entries: AnnotationEntry[] = []

  for (let i = 1; i < parts.length; i += 2) {
    const num = parseInt(parts[i], 10)
    const body = parts[i + 1]?.trim() || ''
    const colonIdx = body.indexOf('：')
    const term = colonIdx >= 0 ? body.slice(0, colonIdx) : ''
    const def = colonIdx >= 0 ? body.slice(colonIdx + 1) : body
    const { segments, remaining } = parsePronSegments(def)
    entries.push({
      num,
      numDisplay: toChineseNumber(num),
      term,
      pronSegments: segments,
      definition: esc(remaining),
    })
  }

  return entries.length ? entries : []
}

export function annotationToPronSegment(ann: Annotation): PronSegment | null {
  if (ann.kind !== 'pronunciation') return null
  const parts = ann.text.replace(/[；;]/g, ' ').trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return null
  const lang = ann.lang === 'yue' ? 'yue' : 'cmn'
  return { lang, label: lang === 'yue' ? '粵' : '普', parts }
}

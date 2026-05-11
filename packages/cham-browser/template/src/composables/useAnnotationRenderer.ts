import { ref } from 'vue'
import type { Annotation } from '../types'
import { useReadingMode } from './useReadingMode'
import { toChineseNumber } from '../utils/chineseNumber'

export interface AnnSpan {
  start: number
  end: number
  annotations: Annotation[]
  overlapping: boolean
}

export function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export function buildVerseAnnotations(annotations: Annotation[], verseIndex: number): AnnSpan[] {
  const anns = annotations.filter(a =>
    a.range.scope === 'verse' && a.range.verseIndex === verseIndex
  )
  if (!anns.length) return []

  const points = new Set<number>()
  for (const a of anns) {
    points.add(a.range.start ?? 0)
    points.add(a.range.end ?? 0)
  }
  const sorted = [...points].sort((a, b) => a - b)

  const segments: AnnSpan[] = []
  for (let i = 0; i < sorted.length - 1; i++) {
    const start = sorted[i]
    const end = sorted[i + 1]
    const covering = anns.filter(a =>
      (a.range.start ?? 0) <= start && (a.range.end ?? 0) >= end
    )
    if (covering.length === 0) continue

    const rangeKeys = new Set(
      covering.map(a => `${a.range.start ?? 0}:${a.range.end ?? 0}`)
    )

    segments.push({
      start,
      end,
      annotations: covering,
      overlapping: rangeKeys.size > 1,
    })
  }

  return segments
}

export function countVerseSpans(annotations: Annotation[], verseIndex: number): number {
  return buildVerseAnnotations(annotations, verseIndex).length
}

export function renderAnnotatedText(text: string, spans: AnnSpan[], useRuby = false, startNum = 0): string {
  if (!spans.length) return esc(text)

  let annCounter = startNum
  let html = ''
  let cursor = 0
  for (const span of spans) {
    if (span.start > cursor) {
      html += esc(text.slice(cursor, span.start))
    }
    annCounter++
    const ids = span.annotations.map(a => a.id).join(',')
    const kinds = [...new Set(span.annotations.map(a => a.kind))].join(' ')
    const overlapCls = span.overlapping ? ' ann-overlap' : ''
    const numText = toChineseNumber(annCounter)
    const body = esc(text.slice(span.start, span.end))
    if (useRuby) {
      const rtCls = numText.length > 1 ? 'ann-num ann-num-long' : 'ann-num'
      html += `<ruby class="ann-target${overlapCls} ${kinds}" data-ann-ids="${ids}">${body}<rp></rp><rt class="${rtCls}">${numText}</rt><rp></rp></ruby>`
    } else {
      html += `<span class="ann-target${overlapCls} ${kinds}" data-ann-ids="${ids}">${body}<sup class="ann-num">${numText}</sup></span>`
    }
    cursor = span.end
  }
  if (cursor < text.length) {
    html += esc(text.slice(cursor))
  }
  return html
}

export interface VerseGutterRender {
  textHtml: string
  gutterHtml: string
}

export function renderVerseGutter(text: string, spans: AnnSpan[], startNum = 0): VerseGutterRender {
  if (!spans.length) return { textHtml: esc(text), gutterHtml: '' }

  const gutter = new Array<string>(text.length).fill('　')
  let annCounter = startNum
  let textHtml = ''
  let cursor = 0

  for (const span of spans) {
    if (span.start > cursor) {
      textHtml += esc(text.slice(cursor, span.start))
    }
    annCounter++
    const ids = span.annotations.map(a => a.id).join(',')
    const kinds = [...new Set(span.annotations.map(a => a.kind))].join(' ')
    const overlapCls = span.overlapping ? ' ann-overlap' : ''
    textHtml += `<span class="ann-target${overlapCls} ${kinds}" data-ann-ids="${ids}">${esc(text.slice(span.start, span.end))}</span>`
    gutter[span.start] = `<span class="ann-gutter-num ${kinds}" data-ann-ids="${ids}">${toChineseNumber(annCounter)}</span>`
    cursor = span.end
  }
  if (cursor < text.length) {
    textHtml += esc(text.slice(cursor))
  }

  return { textHtml, gutterHtml: gutter.join('') }
}

export function resolveHoveredAnnotations(
  event: MouseEvent,
  annotations: Annotation[],
): Annotation[] | null {
  const target = (event.target as HTMLElement).closest('.ann-target') as HTMLElement | null
  if (!target) return null
  const ids = target.getAttribute('data-ann-ids')?.split(',') || []
  const matched = annotations.filter(a => ids.includes(a.id))
  return matched.length ? matched : null
}

export function useAnnotationTooltip() {
  const visible = ref(false)
  const items = ref<Annotation[]>([])
  const style = ref<Record<string, string>>({})
  const { layout } = useReadingMode()

  function show(event: MouseEvent, annotations: Annotation[]) {
    items.value = annotations
    const el = (event.target as HTMLElement).closest('.ann-target') as HTMLElement | null
    const rect = (el ?? event.target as HTMLElement).getBoundingClientRect()

    if (layout.value === 'vertical') {
      const isMobile = window.innerWidth < 768
      if (isMobile) {
        style.value = {
          left: '4vw',
          right: '4vw',
          bottom: '0',
          maxWidth: 'none',
        }
      } else if (window.innerWidth >= 1024) {
        style.value = {
          right: '20px',
          top: '72px',
          maxHeight: 'calc(100vh - 100px)',
        }
      } else {
        const right = window.innerWidth - rect.left + 8
        style.value = {
          right: Math.min(right, window.innerWidth - 40) + 'px',
          top: '50%',
          transform: 'translateY(-50%)',
        }
      }
    } else {
      const isMobile = window.innerWidth < 768
      if (isMobile) {
        style.value = {
          left: '4vw',
          right: '4vw',
          bottom: '0',
          maxWidth: 'none',
        }
      } else {
        const left = Math.max(8, Math.min(rect.left, window.innerWidth - 288))
        const top = Math.max(8, rect.bottom + 8)
        style.value = {
          left: left + 'px',
          top: Math.min(top, window.innerHeight - 200) + 'px',
        }
      }
    }
    visible.value = true
  }

  function hide() { visible.value = false }
  function toggle(event: MouseEvent, annotations: Annotation[]) {
    if (visible.value) {
      const currentIds = items.value.map(a => a.id).sort().join(',')
      const newIds = annotations.map(a => a.id).sort().join(',')
      if (currentIds === newIds) {
        if (window.innerWidth < 768) hide()
      } else {
        show(event, annotations)
      }
    } else {
      show(event, annotations)
    }
  }

  return { visible, items, style, show, hide, toggle }
}

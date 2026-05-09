import { ref } from 'vue'
import type { Annotation } from '../types'
import { useReadingMode } from './useReadingMode'
import { toChineseNumber } from '../utils/chineseNumber'

export interface AnnSpan {
  start: number
  end: number
  annotations: Annotation[]
}

export function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export function buildVerseAnnotations(annotations: Annotation[], verseIndex: number): AnnSpan[] {
  const anns = annotations.filter(a =>
    a.range.scope === 'verse' && a.range.verseIndex === verseIndex
  )
  const spanMap = new Map<string, Annotation[]>()
  for (const a of anns) {
    const key = `${a.range.start ?? 0}:${a.range.end ?? 0}`
    if (!spanMap.has(key)) spanMap.set(key, [])
    spanMap.get(key)!.push(a)
  }
  return Array.from(spanMap.entries()).map(([k, matched]) => {
    const [start, end] = k.split(':').map(Number)
    return { start, end, annotations: matched }
  }).sort((a, b) => a.start - b.start)
}

export function countVerseSpans(annotations: Annotation[], verseIndex: number): number {
  const anns = annotations.filter(a =>
    a.range.scope === 'verse' && a.range.verseIndex === verseIndex
  )
  const keys = new Set<string>()
  for (const a of anns) {
    keys.add(`${a.range.start ?? 0}:${a.range.end ?? 0}`)
  }
  return keys.size
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
    const numText = toChineseNumber(annCounter)
    const body = esc(text.slice(span.start, span.end))
    if (useRuby) {
      const rtCls = numText.length > 1 ? 'ann-num ann-num-long' : 'ann-num'
      html += `<ruby class="ann-target ${kinds}" data-ann-ids="${ids}">${body}<rp></rp><rt class="${rtCls}">${numText}</rt><rp></rp></ruby>`
    } else {
      html += `<span class="ann-target ${kinds}" data-ann-ids="${ids}">${body}<sup class="ann-num">${numText}</sup></span>`
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
    textHtml += `<span class="ann-target ${kinds}" data-ann-ids="${ids}">${esc(text.slice(span.start, span.end))}</span>`
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
      const left = rect.left - 12
      style.value = {
        right: Math.max(8, window.innerWidth - left) + 'px',
        top: '50%',
        transform: 'translateY(-50%)',
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
        // Same annotation: dismiss on mobile only (desktop uses hover to manage)
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

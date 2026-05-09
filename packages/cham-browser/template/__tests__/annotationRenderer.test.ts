import { describe, it, expect } from 'vitest'
import {
  buildVerseAnnotations,
  renderAnnotatedText,
  renderVerseGutter,
  esc,
} from '../src/composables/useAnnotationRenderer'
import type { Annotation } from '../src/types'

function makeAnn(overrides: Partial<Annotation> & { id: string; kind: Annotation['kind'] }): Annotation {
  return {
    text: 'test annotation',
    range: { scope: 'verse', verseIndex: 0, start: 0, end: 1 },
    ...overrides,
  }
}

describe('esc', () => {
  it('escapes HTML special characters', () => {
    expect(esc('<b>test</b>')).toBe('&lt;b&gt;test&lt;/b&gt;')
    expect(esc('a & b')).toBe('a &amp; b')
  })
})

describe('buildVerseAnnotations', () => {
  const anns: Annotation[] = [
    makeAnn({ id: 'a1', kind: 'semantic', range: { scope: 'verse', verseIndex: 0, start: 0, end: 2 } }),
    makeAnn({ id: 'p1', kind: 'pronunciation', range: { scope: 'verse', verseIndex: 0, start: 3, end: 5 } }),
    makeAnn({ id: 'a2', kind: 'semantic', range: { scope: 'verse', verseIndex: 1, start: 0, end: 1 } }),
  ]

  it('returns spans only for the requested verse', () => {
    const spans = buildVerseAnnotations(anns, 0)
    expect(spans).toHaveLength(2)
    expect(spans[0].start).toBe(0)
    expect(spans[0].end).toBe(2)
    expect(spans[1].start).toBe(3)
    expect(spans[1].end).toBe(5)
  })

  it('groups annotations at the same position', () => {
    const overlapping: Annotation[] = [
      makeAnn({ id: 'a1', kind: 'semantic', range: { scope: 'verse', verseIndex: 0, start: 0, end: 2 } }),
      makeAnn({ id: 'p1', kind: 'pronunciation', range: { scope: 'verse', verseIndex: 0, start: 0, end: 2 } }),
    ]
    const spans = buildVerseAnnotations(overlapping, 0)
    expect(spans).toHaveLength(1)
    expect(spans[0].annotations).toHaveLength(2)
  })

  it('returns empty array for verse with no annotations', () => {
    expect(buildVerseAnnotations(anns, 5)).toHaveLength(0)
  })

  it('sorts spans by start position', () => {
    const unsorted: Annotation[] = [
      makeAnn({ id: 'b', kind: 'semantic', range: { scope: 'verse', verseIndex: 0, start: 5, end: 7 } }),
      makeAnn({ id: 'a', kind: 'semantic', range: { scope: 'verse', verseIndex: 0, start: 0, end: 2 } }),
    ]
    const spans = buildVerseAnnotations(unsorted, 0)
    expect(spans[0].start).toBe(0)
    expect(spans[1].start).toBe(5)
  })
})

describe('renderAnnotatedText', () => {
  const anns: Annotation[] = [
    makeAnn({ id: 'a1', kind: 'semantic', range: { scope: 'verse', verseIndex: 0, start: 0, end: 2 } }),
  ]
  const spans = buildVerseAnnotations(anns, 0)

  it('escapes plain text without annotations', () => {
    expect(renderAnnotatedText('hello', [])).toBe('hello')
    expect(renderAnnotatedText('<script>', [])).toBe('&lt;script&gt;')
  })

  it('wraps annotated text in span with ann-target class', () => {
    const html = renderAnnotatedText('明月光', spans, false, 0)
    expect(html).toContain('class="ann-target semantic"')
    expect(html).toContain('data-ann-ids="a1"')
    expect(html).toContain('明月')
  })

  it('wraps annotated text in ruby when useRuby is true', () => {
    const html = renderAnnotatedText('明月光', spans, true, 0)
    expect(html).toContain('<ruby')
    expect(html).toContain('ann-num')
    expect(html).toContain('</ruby>')
  })

  it('outputs Chinese number for annotation markers', () => {
    const html = renderAnnotatedText('明月光', spans, false, 0)
    expect(html).toContain('一')
  })

  it('handles multiple annotations', () => {
    const multi: Annotation[] = [
      makeAnn({ id: 'a1', kind: 'semantic', range: { scope: 'verse', verseIndex: 0, start: 0, end: 2 } }),
      makeAnn({ id: 'a2', kind: 'pronunciation', range: { scope: 'verse', verseIndex: 0, start: 3, end: 4 } }),
    ]
    const multiSpans = buildVerseAnnotations(multi, 0)
    const html = renderAnnotatedText('明月光的', multiSpans, false, 0)
    expect(html).toContain('一')
    expect(html).toContain('二')
  })

  it('preserves text after last annotation', () => {
    const html = renderAnnotatedText('明月光', spans, false, 0)
    expect(html).toContain('光')
  })

  it('preserves text before first annotation', () => {
    const offset: Annotation[] = [
      makeAnn({ id: 'a1', kind: 'semantic', range: { scope: 'verse', verseIndex: 0, start: 2, end: 4 } }),
    ]
    const offsetSpans = buildVerseAnnotations(offset, 0)
    const html = renderAnnotatedText('床前明月', offsetSpans, false, 0)
    expect(html).toContain('床前')
    expect(html).toContain('明月')
  })
})

describe('renderVerseGutter', () => {
  it('returns plain text when no annotations', () => {
    const result = renderVerseGutter('床前明月光', [])
    expect(result.textHtml).toBe('床前明月光')
    expect(result.gutterHtml).toBe('')
  })

  it('generates gutter numbers for annotated ranges', () => {
    const anns: Annotation[] = [
      makeAnn({ id: 'a1', kind: 'semantic', range: { scope: 'verse', verseIndex: 0, start: 0, end: 2 } }),
    ]
    const spans = buildVerseAnnotations(anns, 0)
    const result = renderVerseGutter('明月光', spans, 0)
    expect(result.textHtml).toContain('ann-target')
    expect(result.gutterHtml).toContain('ann-gutter-num')
    expect(result.gutterHtml).toContain('一')
  })
})

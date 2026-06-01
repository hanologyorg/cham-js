import { computed, type Ref } from 'vue'
import type { Annotation, VerseLine } from '../types'
import { buildVerseAnnotations, renderAnnotatedText, resolveHoveredAnnotations } from './useAnnotationRenderer'

export function useAnnotatedVerses(
  verses: Ref<VerseLine[]>,
  annotations: Ref<Annotation[]>,
  isVertical: boolean
) {
  const allVerseSpans = computed(() => {
    const result = verses.value.map((v, i) => {
      const spans = buildVerseAnnotations(annotations.value, i)
      return spans
    })
    return result
  })

  const verseOffsets = computed(() => {
    const offsets: number[] = []
    let acc = 0
    for (const spans of allVerseSpans.value) {
      offsets.push(acc)
      acc += spans.length
    }
    return offsets
  })

  function verseHtml(index: number): string {
    const spans = allVerseSpans.value[index]
    return renderAnnotatedText(verses.value[index].text, spans, isVertical, verseOffsets.value[index])
  }

  function resolveAnnotations(event: MouseEvent): Annotation[] | null {
    return resolveHoveredAnnotations(event, annotations.value)
  }

  return { allVerseSpans, verseOffsets, verseHtml, resolveAnnotations }
}

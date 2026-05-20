import type { Annotation } from '../types'

const KIND_LABELS: Record<string, string> = {
  pronunciation: '讀音',
  semantic: '釋義',
  etymology: '詞源',
  note: '備注',
  definition: '釋義',
  commentary: '注',
  translation: '譯文',
  person: '人名',
  place: '地名',
  event: '事件',
  date: '紀年',
  allusion: '典故',
}

export function kindLabel(ann: Annotation): string {
  return KIND_LABELS[ann.kind] || ann.kind
}

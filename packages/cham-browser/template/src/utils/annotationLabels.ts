import type { Annotation } from '../types'
import { useI18n } from '../composables/useI18n'

const KIND_I18N_KEYS: Record<string, string> = {
  pronunciation: 'annotation.kind.pronunciation',
  semantic: 'annotation.kind.semantic',
  etymology: 'annotation.kind.etymology',
  note: 'annotation.kind.note',
  definition: 'annotation.kind.definition',
  commentary: 'annotation.kind.commentary',
  translation: 'annotation.kind.translation',
  person: 'annotation.kind.person',
  place: 'annotation.kind.place',
  event: 'annotation.kind.event',
  date: 'annotation.kind.date',
  allusion: 'annotation.kind.allusion',
}

export function kindLabel(ann: Annotation): string {
  const key = KIND_I18N_KEYS[ann.kind]
  if (key) {
    const { t } = useI18n()
    return t(key)
  }
  return ann.kind
}

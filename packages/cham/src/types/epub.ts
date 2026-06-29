// ─── ePub Converter Types ──────────────────────────────────────
// Options and intermediate shapes used by the ePub → CHAM converter.

import type { AnnotationKind, SkqsVariant } from './core.js'
import type { BookConfig } from './book.js'

export interface EpubConversionOptions {
  epubPath: string
  outputDir: string
  bookConfig: Partial<BookConfig>
  contributor?: string
  layerContributor?: string
  layerId?: string
}

export interface EpubAnnotation {
  text: string
  kind: AnnotationKind
  headword?: string
  isCollation: boolean
  isFanqie: boolean
  skqsVariant?: SkqsVariant
}

export interface EpubSection {
  title: string
  num: number
  textParts: string[]
  annotations: EpubAnnotation[]
}

export interface EpubVolume {
  label: string
  sections: EpubSection[]
}

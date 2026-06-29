// ─── Book & Library Types ──────────────────────────────────────
// Configuration and metadata for books, volumes, layers, and library
// indices. Used by book.yaml loading, BookBuilder, LibraryBuilder,
// and ChamJsonConverter.

import type {
  ChamContributor, ChamDate, HierarchyLevelName,
} from './core.js'

export type LibraryScale = 'single-piece' | 'single-book' | 'library'
export type BookGenre = 'poetry' | 'prose' | 'mixed' | 'drama'

export interface BookLayer {
  id: string
  label: string
  shortLabel?: string
  contributor: string
  role?: string
  nature?: string
  displayOrder?: number
  enabled?: boolean
}

export interface BookAnnotationDefaults {
  defaultLabel?: string
  defaultShortLabel?: string
}

export interface VolumeConfig {
  label: string
  pieces: string[]
}

export interface BookGroup {
  id: string
  label: string
  piece: number
}

export interface BookConfig {
  id: string
  title: string
  subtitle?: string
  'title-en'?: string
  publisher?: string
  genre?: BookGenre
  contributors?: ChamContributor[]
  date?: ChamDate
  hero?: string[]
  layers?: BookLayer[]
  annotation?: BookAnnotationDefaults
  volumes?: VolumeConfig[]
  hierarchy?: HierarchyLevelName[]
  groups?: BookGroup[]
}

export interface BookMeta {
  id: string
  title: string
  subtitle?: string
  'title-en'?: string
  publisher?: string
  genre: BookGenre
  count: number
  hero?: string[]
  layers?: BookLayer[]
  annotation?: BookAnnotationDefaults
  volumes?: VolumeConfig[]
  hierarchy?: HierarchyLevelName[]
  groups?: BookGroup[]
}

export interface CrossRef {
  focusedBookId: string
  focusedNum: number
  fullBookId: string
  fullNum?: number
  relation: 'section' | 'excerpt' | 'complete'
}

export interface LibraryIndex {
  scale: LibraryScale
  books: BookMeta[]
  crossRefs?: CrossRef[]
}

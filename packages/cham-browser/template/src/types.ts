// ─── Types namespace ───────────────────────────────────────────
// cham-browser re-exports canonical types from @hanology/cham to avoid
// type drift. Frontend-specific display types (Piece, Annotation,
// AnnotationEntry, etc.) live here — they wrap cham's pipeline output
// with display-only fields (pronSegments, numDisplay, etc.).

// ─── Re-exported from @hanology/cham (canonical source of truth) ──
export type {
  LibraryScale,
  BookGenre,
  BookLayer,
  BookAnnotationDefaults,
  BookMeta,
  CrossRef,
  LibraryIndex,
  PieceContributor,
  HierarchyLevel,
  PieceSource,
} from '@hanology/cham/types'

// Re-import for use in frontend-specific types below.
import type {
  BookGenre,
  PieceSource,
  PieceContributor,
  HierarchyLevel,
} from '@hanology/cham/types'

// ─── Book data (frontend Piece, not cham's OutputPiece) ─────────

export interface BookData {
  meta: import('@hanology/cham/types').BookMeta
  pieces: Piece[]
}

// ─── Annotation model (display-flavored) ────────────────────────

export interface TextRange {
  type: 'point' | 'range' | 'full'
  scope: 'verse' | 'title' | 'section' | 'full_text'
  verseIndex?: number
  sectionKey?: string
  start?: number
  end?: number
}

export interface Annotation {
  id: string
  range: TextRange
  kind: 'pronunciation' | 'semantic' | 'etymology' | 'note' | 'definition' | 'commentary' | 'translation'
  lang?: string
  text: string
  source: string
}

export interface PronSegment {
  lang: 'yue' | 'cmn'
  label: string
  parts: string[]
}

export interface AnnotationEntry {
  num: number
  numDisplay: string
  term: string
  pronSegments: PronSegment[]
  definition: string
}

export interface VerseLine {
  text: string
}

export interface AnnotationLayer {
  id: string
  label: string
  shortLabel: string
  contributor: string
  role: string
  nature: string
  displayOrder: number
  enabled: boolean
  annotations: Annotation[]
}

// ─── Prose, parts, pieces ───────────────────────────────────────

export interface ProseSection {
  key: string
  title: string
  filename: string
  body: string
  order: number
}

export interface Part {
  num: number
  group?: string
  title?: string
  source?: PieceSource
  verses: VerseLine[]
  annotations: Annotation[]
  annotationText?: string
}

export interface Piece {
  bookId: string
  num: number
  title: string
  author: string
  authorId: string
  era: string
  dynasty?: string
  genre: BookGenre
  hierarchy?: HierarchyLevel[]
  verses: VerseLine[]
  sections: Record<string, string>
  structuredSections?: ProseSection[]
  annotations: Annotation[]
  layers?: Record<string, Annotation[]>
  annotationLayers?: AnnotationLayer[]
  source?: PieceSource
  contributors?: PieceContributor[]
  parts?: Part[]
}

/** Backward-compatibility alias. */
export type Poem = Piece

// ─── Author & Dynasty (JSON-LD display shapes) ──────────────────

export interface Author {
  '@id': string
  '@type': string
  name: string
  era: string
  workCount: number
  works?: string[]
  bio?: string
  born?: string
  died?: string
  courtesyName?: string
  artName?: string
  wikidata?: string
  ctextId?: string
  wikipediaZh?: string
  wikipediaEn?: string
}

export interface Dynasty {
  '@id': string
  '@type': string
  name: string
  authors: string[]
  workCount: number
}

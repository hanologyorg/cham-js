// ─── Library ────────────────────────────────────────────────────

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

export interface BookMeta {
  id: string
  title: string
  subtitle?: string
  titleEn?: string
  publisher?: string
  genre: BookGenre
  count: number
  hero?: string[]
  layers?: BookLayer[]
  annotation?: BookAnnotationDefaults
}

export interface CrossRef {
  focusedBookId: string
  focusedNum: number
  fullBookId: string
  fullNum?: number
  relation: 'section' | 'excerpt'
}

export interface LibraryIndex {
  scale: LibraryScale
  books: BookMeta[]
  crossRefs?: CrossRef[]
}

export interface BookData {
  meta: BookMeta
  pieces: Piece[]
}

// ─── Piece ──────────────────────────────────────────────────────

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

export interface PieceContributor {
  id: string
  name: string
  role: string
  title?: string
}

export interface PieceSource {
  text?: string
  textRef?: string
  pieceRef?: number
  relation: 'section' | 'excerpt' | 'standalone'
  range?: { start?: string; end?: string; chapter?: string; [key: string]: string | undefined }
}

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
  dynasty: string
  genre: BookGenre
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

// Backward compatibility alias
export type Poem = Piece

// ─── Author & Dynasty ───────────────────────────────────────────

export interface Author {
  '@id': string
  '@type': string
  name: string
  dynasty: string
  poemCount: number
  bio?: string
}

export interface Dynasty {
  '@id': string
  '@type': string
  name: string
  authors: string[]
  poemCount: number
}

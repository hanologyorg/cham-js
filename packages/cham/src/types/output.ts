// ─── Pipeline Output Types ─────────────────────────────────────
// Shapes produced by the pipeline for frontend consumption: pieces,
// annotations, layers, parts, prose sections. Plus the BookData /
// LibraryData aggregates.

import type {
  AnnotationKind, HierarchyLevel, PieceSource,
} from './core.js'
import type { BookGenre, BookMeta } from './book.js'

export interface OutputPart {
  num: number
  group?: string
  title?: string
  source?: PieceSource
  verses: { text: string }[]
  annotations: OutputAnnotation[]
  annotationText?: string
}

export interface OutputRange {
  type: 'range'
  scope: 'title' | 'verse'
  verseIndex?: number
  start: number
  end: number
}

export interface OutputAnnotation {
  id: string
  range: OutputRange
  kind: AnnotationKind
  lang?: string
  text: string
  source: string
  /**
   * Author/contributor registry ID for this specific annotation.
   * Propagated from the annotation section's `@contributor` metadata.
   * Falls back to the layer-level contributor when the section has none.
   */
  contributor?: string
}

export interface OutputAnnotationLayer {
  id: string
  label: string
  shortLabel: string
  contributor: string
  role: string
  nature: string
  displayOrder: number
  enabled: boolean
  annotations: OutputAnnotation[]
}

export interface OutputProseSection {
  key: string
  title: string
  filename: string
  body: string
  order: number
}

/** Identity fields shared across all pieces in a book. */
export interface PieceIdentity {
  bookId: string
  num: number
  title: string
  author: string
  authorId: string
  dynasty: string
  era: string
  eraCode?: string
  genre: BookGenre
  hierarchy?: HierarchyLevel[]
  contributors?: PieceContributor[]
}

/** The piece's textual content: verses + prose sections. */
export interface PieceContent {
  verses: { text: string }[]
  sections: Record<string, string>
  structuredSections?: OutputProseSection[]
  source?: PieceSource
}

/** Annotations on the piece's content (primary + per-layer). */
export interface PieceAnnotations {
  annotations: OutputAnnotation[]
  layers?: Record<string, OutputAnnotation[]>
  annotationLayers?: OutputAnnotationLayer[]
}

/** Sub-parts within a piece (e.g. chapters of a longer work). */
export interface PieceParts {
  parts?: OutputPart[]
}

/**
 * Full piece output: identity + content + annotations + parts.
 *
 * Consumers needing only one facet can use the sub-interfaces
 * ({@link PieceIdentity}, {@link PieceContent}, {@link PieceAnnotations},
 * {@link PieceParts}); the flat composition preserves backwards
 * compatibility for existing callers.
 */
export interface OutputPiece
  extends PieceIdentity, PieceContent, PieceAnnotations, PieceParts {}

export interface PieceContributor {
  id: string
  name: string
  role: string
  title?: string
}

export interface BookData {
  meta: BookMeta
  pieces: OutputPiece[]
}

/**
 * Pre-loaded CHAM sources for a single piece, ready to be fed to a
 * builder. ChamJsonConverter produces these from disk; BookBuilder
 * consumes them. Tests can construct them in-memory without fs.
 */
export interface PieceSources {
  readonly chamSource: string
  readonly proseFiles?: ReadonlyMap<string, string>
  readonly layerFiles?: ReadonlyMap<string, string>
  readonly partFiles?: ReadonlyMap<string, string>
}

/**
 * Pre-loaded sources for a complete book: its config and the
 * PieceSources for each piece. LibraryBuilder consumes these.
 */
export interface BookSources {
  readonly config: import('./book.js').BookConfig
  readonly pieces: readonly PieceSources[]
}

/**
 * LibraryBuilder output: the assembled LibraryIndex plus the
 * per-book BookData and the flat piece list. I/O adapters choose
 * which slices to write.
 */
export interface LibraryData {
  readonly library: import('./book.js').LibraryIndex
  readonly books: readonly BookData[]
  readonly allPieces: readonly OutputPiece[]
}

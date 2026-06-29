// ─── Library Index Builder ────────────────────────────────────
// Composes the LibraryIndex output: scale classification, cross-piece
// references, and the assembled index. These three functions share
// data flow — book metas + pieces → LibraryIndex — and belong together.

import type {
  LibraryIndex, LibraryScale, CrossRef, BookMeta, OutputPiece, PieceSource,
} from '../types.js'

/**
 * Detects the library scale from book count and piece count.
 * - 0 books or 1 book with ≤1 piece → single-piece
 * - 1 book with >1 piece → single-book
 * - >1 books → library
 */
export function detectScale(bookCount: number, singleBookPieceCount?: number): LibraryScale {
  if (bookCount === 0) return 'single-piece'
  if (bookCount === 1) return (singleBookPieceCount ?? 0) <= 1 ? 'single-piece' : 'single-book'
  return 'library'
}

/**
 * Builds cross-reference links between focused (excerpt) pieces and full pieces.
 * Skips standalone pieces and pieces without a textRef.
 */
export function buildCrossRefs(allPieces: readonly OutputPiece[]): CrossRef[] {
  const refs: CrossRef[] = []
  for (const piece of allPieces) {
    const src = piece.source as PieceSource | undefined
    if (!src || src.relation === 'standalone') continue
    if (!src.textRef) continue
    refs.push({
      focusedBookId: piece.bookId,
      focusedNum: piece.num,
      fullBookId: src.textRef,
      fullNum: src.pieceRef,
      relation: src.relation,
    })
  }
  return refs
}

/**
 * Builds a LibraryIndex from book metas and all pieces.
 */
export function buildLibraryIndex(
  bookMetas: readonly BookMeta[],
  allPieces: readonly OutputPiece[],
): LibraryIndex {
  return {
    scale: detectScale(bookMetas.length, allPieces.length),
    books: [...bookMetas],
    crossRefs: buildCrossRefs(allPieces),
  }
}

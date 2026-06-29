// ─── Library Builder ───────────────────────────────────────────
// The top-level orchestrator for assembling a complete library from
// pre-loaded book sources. This is the pipeline's public entry point
// for multi-book assembly: pure data in, data out.
//
// ChamJsonConverter and cham-browser CLI both delegate here — they
// walk directories to produce BookSources[], then LibraryBuilder
// produces LibraryData, then each adapter writes whichever outputs
// it needs.

import type {
  AuthorRecord, BookSources, LibraryData,
} from '../types.js'
import { BookBuilder } from './book-builder.js'
import { buildLibraryIndex } from './library-index-builder.js'

/**
 * Deep orchestrator: builds a complete library (multiple books) from
 * pre-loaded sources. Pure — no filesystem access.
 *
 * Construction:
 *   new LibraryBuilder()                  // no authors
 *   new LibraryBuilder(authorsRecord)     // with authors
 *
 * Use:
 *   const data = builder.buildFromBooks(bookSources)
 *
 * Returns {@link LibraryData}: the library index, per-book BookData,
 * and the flat piece list. Adapters pick which slices to serialise.
 */
export class LibraryBuilder {
  constructor(
    private readonly authors: Record<string, AuthorRecord> = {},
  ) {}

  /**
   * Build every book from its sources, aggregate pieces, and compose
   * the LibraryIndex. Books are processed in input order.
   */
  buildFromBooks(books: readonly BookSources[]): LibraryData {
    const bookDataList = books.map(b =>
      new BookBuilder(b.config, this.authors).buildFromSources(b.pieces),
    )
    const allPieces = bookDataList.flatMap(b => b.pieces)
    const bookMetas = bookDataList.map(b => b.meta)
    return {
      library: buildLibraryIndex(bookMetas, allPieces),
      books: bookDataList,
      allPieces,
    }
  }
}

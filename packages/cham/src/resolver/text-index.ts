// ─── Text Search Index ─────────────────────────────────────────
// Builds a searchable index over text blocks for resolving external
// text-quote references (@[quote]). Provides exact-match lookup with
// optional verse disambiguation.

import type { TextBlock } from '../types.js'

export interface TextIndexEntry {
  /** Index of the text block (verse) containing this match. */
  readonly verseIndex: number
  /** Character offset within the verse where the match starts (inclusive). */
  readonly charStart: number
  /** Character offset within the verse where the match ends (exclusive). */
  readonly charEnd: number
}

export class TextQuoteNotFoundError extends Error {
  constructor(readonly quote: string, readonly verseHint?: number) {
    const hint = verseHint !== undefined ? ` in verse ${verseHint}` : ''
    super(`Text quote not found${hint}: "${quote}"`)
    this.name = 'TextQuoteNotFoundError'
  }
}

export class TextQuoteAmbiguousError extends Error {
  constructor(
    readonly quote: string,
    readonly matches: readonly TextIndexEntry[],
  ) {
    super(
      `Text quote is ambiguous (${matches.length} matches): "${quote}". ` +
      `Add a verse hint: @${matches[0].verseIndex}[${quote}]`,
    )
    this.name = 'TextQuoteAmbiguousError'
  }
}

/**
 * Searchable index over a document's text blocks.
 *
 * Construction is O(n) where n = total text length.
 * Lookup is O(m * k) where m = quote length, k = occurrences — fast for
 * the short quotes (2–12 chars) typical in classical Chinese annotation.
 *
 * Immutable after construction.
 */
export class TextIndex {
  private readonly blockTexts: readonly string[]

  constructor(textBlocks: readonly TextBlock[]) {
    this.blockTexts = textBlocks.map(b => b.text)
  }

  /**
   * Find all occurrences of `quote` across all indexed verses.
   * Returns entries in verse order, then character order within each verse.
   */
  findAll(quote: string): readonly TextIndexEntry[] {
    if (quote.length === 0) return []
    const results: TextIndexEntry[] = []
    for (let vi = 0; vi < this.blockTexts.length; vi++) {
      const text = this.blockTexts[vi]
      let from = 0
      while (true) {
        const idx = text.indexOf(quote, from)
        if (idx === -1) break
        results.push({
          verseIndex: vi,
          charStart: idx,
          charEnd: idx + quote.length,
        })
        from = idx + 1 // allow overlapping matches
      }
    }
    return results
  }

  /**
   * Resolve a quote to a single position.
   *
   * @param quote The exact text to search for.
   * @param verseHint Optional verse index to disambiguate repeated phrases.
   * @throws {TextQuoteNotFoundError} if no match exists.
   * @throws {TextQuoteAmbiguousError} if multiple matches exist and no hint narrows to one.
   */
  resolveUnique(quote: string, verseHint?: number): TextIndexEntry {
    let matches = this.findAll(quote)
    if (verseHint !== undefined) {
      matches = matches.filter(m => m.verseIndex === verseHint)
    }
    if (matches.length === 0) {
      throw new TextQuoteNotFoundError(quote, verseHint)
    }
    if (matches.length > 1) {
      throw new TextQuoteAmbiguousError(quote, matches)
    }
    return matches[0]
  }

  /** Number of indexed verses. */
  get verseCount(): number {
    return this.blockTexts.length
  }

  /** Character length of a specific verse. Returns 0 if index out of range. */
  verseLength(verseIndex: number): number {
    return this.blockTexts[verseIndex]?.length ?? 0
  }
}

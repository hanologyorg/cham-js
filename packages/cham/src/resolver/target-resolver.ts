// ─── Target Resolver ───────────────────────────────────────────
// Centralizes resolution of all annotation target types to concrete
// text ranges. The single place that knows how to turn an
// AnnotationTarget into a ResolvedTarget.
//
// This replaces the scattered target-switching previously found in
// parser, pipeline, serializer, and validator.

import type {
  AnnotationTarget, MarkerTable, TextBlock,
} from '../types.js'
import { TextIndex, TextQuoteNotFoundError, TextQuoteAmbiguousError } from './text-index.js'

export interface ResolvedTarget {
  /** Verse (text block) index. -1 for title/full targets. */
  readonly verseIndex: number
  /** Start character offset (inclusive). */
  readonly charStart: number
  /** End character offset (exclusive — use with slice()). */
  readonly charEnd: number
  /** Output scope for range building. */
  readonly scope: 'title' | 'verse'
}

export type TargetResolutionReason =
  | 'missing-marker'
  | 'ambiguous-text'
  | 'unresolved-text'
  | 'invalid-verse'

export class TargetResolutionError extends Error {
  constructor(
    message: string,
    readonly target: AnnotationTarget,
    readonly reason: TargetResolutionReason,
  ) {
    super(message)
    this.name = 'TargetResolutionError'
  }
}

/**
 * Resolves annotation targets against a primary document.
 *
 * Construct one resolver per primary document. It builds a TextIndex
 * (O(n)) once and reuses it for all annotation lookups.
 *
 * For secondary (commentary) files, construct the resolver from the
 * PRIMARY document's markers and text blocks — that's what the targets
 * refer to.
 */
export class TargetResolver {
  private readonly textIndex: TextIndex

  constructor(
    private readonly markers: MarkerTable,
    textBlocks: readonly TextBlock[],
  ) {
    this.textIndex = new TextIndex(textBlocks)
  }

  /**
   * Resolve a target to a concrete range.
   * @throws {TargetResolutionError} on any resolution failure.
   */
  resolve(target: AnnotationTarget): ResolvedTarget {
    switch (target.type) {
      case 'title':
        return { verseIndex: -1, charStart: 0, charEnd: 1, scope: 'title' }

      case 'full':
        return { verseIndex: -1, charStart: 0, charEnd: 0, scope: 'title' }

      case 'marker': {
        const marker = this.markers.get(target.markerId)
        if (!marker) {
          throw new TargetResolutionError(
            `Marker {${target.markerId}} not found in primary text`,
            target, 'missing-marker',
          )
        }
        return {
          verseIndex: marker.blockIndex,
          charStart: marker.offset,
          charEnd: marker.offset + marker.length,
          scope: 'verse',
        }
      }

      case 'verse': {
        const { line, char, end } = target
        if (line < 0 || line >= this.textIndex.verseCount) {
          throw new TargetResolutionError(
            `Verse target references non-existent block ${line}`,
            target, 'invalid-verse',
          )
        }
        return {
          verseIndex: line,
          charStart: char,
          charEnd: end ?? char + 1,
          scope: 'verse',
        }
      }

      case 'verse-all': {
        const { line } = target
        if (line < 0 || line >= this.textIndex.verseCount) {
          throw new TargetResolutionError(
            `Verse-all target references non-existent block ${line}`,
            target, 'invalid-verse',
          )
        }
        return {
          verseIndex: line,
          charStart: 0,
          charEnd: this.textIndex.verseLength(line),
          scope: 'verse',
        }
      }

      case 'text': {
        try {
          const entry = this.textIndex.resolveUnique(target.quote, target.verseHint)
          return {
            verseIndex: entry.verseIndex,
            charStart: entry.charStart,
            charEnd: entry.charEnd,
            scope: 'verse',
          }
        } catch (e) {
          if (e instanceof TextQuoteNotFoundError) {
            throw new TargetResolutionError(e.message, target, 'unresolved-text')
          }
          if (e instanceof TextQuoteAmbiguousError) {
            throw new TargetResolutionError(e.message, target, 'ambiguous-text')
          }
          throw e
        }
      }
    }
  }

  /**
   * Resolve without throwing. Returns undefined on any resolution failure.
   * Useful for validation passes that collect issues rather than aborting.
   */
  tryResolve(target: AnnotationTarget): ResolvedTarget | undefined {
    try {
      return this.resolve(target)
    } catch {
      return undefined
    }
  }
}

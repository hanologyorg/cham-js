// ─── Book Builder ──────────────────────────────────────────────
// The top-level orchestrator for assembling a BookData from a config
// and pre-loaded piece sources. This is the pipeline's public entry
// point for book-level assembly: pure data in, data out.
//
// ChamJsonConverter is a thin I/O adapter around BookBuilder — it
// reads directories, calls BookBuilder, writes JSON. EpubConverter
// and any other consumer can reuse BookBuilder directly without
// touching the filesystem.

import type {
  BookConfig, BookMeta, BookData,
  OutputPiece, AuthorRecord, PieceSources,
} from '../types.js'
import { buildPieceFromCham } from './piece-builder.js'

/**
 * Builds BookMeta from a book config and piece count.
 * Copies through config fields and adds the computed `count`.
 */
export function buildBookMeta(config: BookConfig, pieceCount: number): BookMeta {
  return {
    id: config.id,
    title: config.title,
    subtitle: config.subtitle,
    'title-en': config['title-en'],
    publisher: config.publisher,
    genre: config.genre || 'poetry',
    count: pieceCount,
    hero: config.hero,
    layers: config.layers,
    annotation: config.annotation,
  }
}

/**
 * Combines book meta and pieces into a BookData object.
 */
export function buildBookData(config: BookConfig, pieces: BookData['pieces']): BookData {
  return { meta: buildBookMeta(config, pieces.length), pieces }
}

/**
 * Deep orchestrator: builds a complete `BookData` from a config and
 * pre-loaded piece sources. Pure — no filesystem access.
 *
 * Construction:
 *   new BookBuilder(config)                        // no authors
 *   new BookBuilder(config, authorsRecord)         // with authors
 *
 * Use:
 *   const bookData = builder.buildFromSources(pieceSources)
 *
 * The class is the canonical pipeline entry point for book-level
 * assembly. ChamJsonConverter and EpubConverter both delegate here.
 */
export class BookBuilder {
  constructor(
    private readonly config: BookConfig,
    private readonly authors: Record<string, AuthorRecord> = {},
  ) {}

  /**
   * Build every piece from its sources, then assemble into a BookData.
   * Pieces that fail to parse (e.g. secondary meta where primary was
   * expected) are silently dropped — callers should validate upstream.
   */
  buildFromSources(pieces: readonly PieceSources[]): BookData {
    const outputPieces = pieces
      .map(p => this.buildPiece(p))
      .filter((p): p is OutputPiece => p !== null)
    return buildBookData(this.config, outputPieces)
  }

  private buildPiece(sources: PieceSources): OutputPiece | null {
    return buildPieceFromCham(
      sources.chamSource,
      this.config,
      this.authors,
      this.config.id,
      sources.proseFiles ?? new Map(),
      sources.layerFiles ?? new Map(),
      sources.partFiles,
    )
  }
}

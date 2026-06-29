// ─── Site Writer ───────────────────────────────────────────────
// Writes LibraryBuilder output to the site's data directory in the
// formats the frontend expects: library.json, per-book JSONs,
// per-piece JSONs, author index + detail, dynasty index, piece index.

import { writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import {
  buildAuthorsJson, buildDynastiesJson,
} from '@hanology/cham/pipeline'
import type {
  AuthorRecord, BookData, LibraryData, OutputPiece,
} from '@hanology/cham/types'

export interface SiteWriterOptions {
  /** Output directory (the site's dist root). Data goes to `${outputDir}/data`. */
  readonly outputDir: string
  /** Pretty-print JSON with 2-space indent; default false (compact). */
  readonly pretty?: boolean
}

export interface WriteResult {
  bookCount: number
  pieceCount: number
  authorCount: number
}

/**
 * Writes pipeline output to the site's data directory. One instance per
 * build; the constructor creates the directory layout.
 *
 * Output layout:
 *   ${outputDir}/data/
 *     library.json
 *     index.json               (lightweight piece index)
 *     dynasties.json
 *     books/
 *       ${id}.json             (full book data)
 *       ${id}.meta.json        (book meta only)
 *     pieces/
 *       ${bookId}/${num}.json  (per-piece)
 *     authors/
 *       index.json
 *       ${ref}.json            (per-author detail)
 */
export class SiteWriter {
  private readonly dataDir: string
  private readonly indent: number

  constructor(opts: SiteWriterOptions) {
    this.dataDir = join(opts.outputDir, 'data')
    this.indent = opts.pretty ? 2 : 0
    for (const sub of ['', 'books', 'pieces', 'authors']) {
      mkdirSync(join(this.dataDir, sub), { recursive: true })
    }
  }

  /** Writes all outputs from a LibraryData + author registry. */
  writeAll(data: LibraryData, authors: Record<string, AuthorRecord>): WriteResult {
    this.writeLibraryIndex(data.library)
    for (const bd of data.books) this.writeBook(bd)
    this.writePieceIndex(data.allPieces)
    this.writePieces(data.allPieces)
    this.writeAuthors(authors, data.allPieces)
    this.writeDynasties(data.allPieces)
    return {
      bookCount: data.books.length,
      pieceCount: data.allPieces.length,
      authorCount: Object.keys(authors).length,
    }
  }

  private writeJson(path: string, value: unknown): void {
    writeFileSync(path, JSON.stringify(value, null, this.indent), 'utf-8')
  }

  writeLibraryIndex(library: LibraryData['library']): void {
    this.writeJson(join(this.dataDir, 'library.json'), library)
  }

  writeBook(bookData: BookData): void {
    this.writeJson(join(this.dataDir, 'books', `${bookData.meta.id}.json`), bookData)
    this.writeJson(join(this.dataDir, 'books', `${bookData.meta.id}.meta.json`), bookData.meta)
  }

  writePieces(pieces: readonly OutputPiece[]): void {
    for (const piece of pieces) {
      const pieceDir = join(this.dataDir, 'pieces', piece.bookId)
      mkdirSync(pieceDir, { recursive: true })
      this.writeJson(join(pieceDir, `${piece.num}.json`), piece)
    }
  }

  writePieceIndex(pieces: readonly OutputPiece[]): void {
    const index = pieces.map(p => ({
      id: `${p.bookId}/${p.num}`,
      t: p.title,
      a: p.author,
      ar: p.authorId,
      e: p.era || p.dynasty,
      ec: p.eraCode || '',
      b: p.bookId,
      g: p.genre,
      n: p.num,
      v1: p.verses[0]?.text?.slice(0, 20) || '',
    }))
    this.writeJson(join(this.dataDir, 'index.json'), index)
  }

  writeAuthors(authors: Record<string, AuthorRecord>, pieces: readonly OutputPiece[]): void {
    const workCounts = new Map<string, { works: string[]; era: string; eraCode: string }>()
    for (const p of pieces) {
      if (!workCounts.has(p.authorId)) {
        const author = authors[p.authorId]
        workCounts.set(p.authorId, {
          works: [],
          era: author?.era || author?.dynasty || p.era || p.dynasty,
          eraCode: author?.eraCode || p.eraCode || '',
        })
      }
      workCounts.get(p.authorId)!.works.push(`${p.bookId}/${p.num}`)
    }

    const authorIndex: Array<{ id: string; name: string; era: string; eraCode: string; workCount: number }> = []
    for (const [ref, authorData] of Object.entries(authors)) {
      if (!authorData.name) continue
      const wc = workCounts.get(ref)
      const entry = {
        id: ref,
        name: authorData.name,
        era: wc?.era || authorData.era || authorData.dynasty || '',
        eraCode: wc?.eraCode || authorData.eraCode || '',
        workCount: wc?.works.length || 0,
      }
      authorIndex.push(entry)

      this.writeJson(join(this.dataDir, 'authors', `${ref}.json`), {
        ...entry,
        names: [],
        bio: authorData.bio || '',
        bioSource: '',
        ctext: authorData.ctextId ? Number(authorData.ctextId) : undefined,
        wikidata: authorData.wikidata,
        wikipediaZh: authorData.wikipediaZh,
        wikipediaEn: authorData.wikipediaEn,
        works: wc?.works || [],
      })
    }
    this.writeJson(join(this.dataDir, 'authors', 'index.json'), authorIndex)
  }

  writeDynasties(pieces: readonly OutputPiece[]): void {
    this.writeJson(join(this.dataDir, 'dynasties.json'), buildDynastiesJson(pieces))
  }
}

/** Convenience for callers that need the JSON-LD author list (rare). */
export function buildAuthorJsonLd(
  authors: Record<string, AuthorRecord>, pieces: readonly OutputPiece[],
) {
  return buildAuthorsJson(authors, pieces)
}

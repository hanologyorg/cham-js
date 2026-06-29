import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { buildCrossRefs, BookBuilder } from './pipeline.js'
import { loadBookConfig } from './book-config-loader.js'
import type {
  BookConfig, BookMeta, BookData, LibraryIndex, LibraryScale,
  OutputPiece, AuthorRecord, PieceSources,
} from './types.js'

// ─── ChamJsonConverter ────────────────────────────────────────
// I/O adapter around BookBuilder. Reads directories → builds pure
// PieceSources → delegates to BookBuilder → writes JSON.

export interface BookConvertOptions {
  bookDir: string
  outputDir?: string
  authors?: Record<string, AuthorRecord>
}

export interface LibraryConvertOptions {
  libraryDir: string
  outputDir: string
  authors?: Record<string, AuthorRecord>
}

export interface LibraryConvertResult {
  library: LibraryIndex
  bookData: BookData[]
  allPieces: OutputPiece[]
}

export class ChamJsonConverter {
  convertBook(opts: BookConvertOptions): BookData {
    const config = loadBookConfig(opts.bookDir)
    const pieceSources = this.readPieceSources(opts.bookDir)
    const bookData = new BookBuilder(config, opts.authors || {}).buildFromSources(pieceSources)

    if (opts.outputDir) {
      mkdirSync(opts.outputDir, { recursive: true })
      writeFileSync(
        join(opts.outputDir, `${config.id}.json`),
        JSON.stringify(bookData, null, 2),
        'utf-8',
      )
    }
    return bookData
  }

  convertLibrary(opts: LibraryConvertOptions): LibraryConvertResult {
    mkdirSync(opts.outputDir, { recursive: true })
    mkdirSync(join(opts.outputDir, 'books'), { recursive: true })

    const books = this.scanBooks(opts.libraryDir)
    const scale = this.detectScale(books)

    const allPieces: OutputPiece[] = []
    const bookMetas: BookMeta[] = []
    const bookDataList: BookData[] = []

    for (const { config, dir } of books) {
      const bookData = this.convertBook({
        bookDir: dir,
        outputDir: join(opts.outputDir, 'books'),
        authors: opts.authors,
      })
      bookMetas.push(bookData.meta)
      bookDataList.push(bookData)
      allPieces.push(...bookData.pieces)
    }

    const crossRefs = buildCrossRefs(allPieces)
    const library: LibraryIndex = { scale, books: bookMetas, crossRefs }

    writeFileSync(
      join(opts.outputDir, 'library.json'),
      JSON.stringify(library, null, 2),
      'utf-8',
    )

    console.log(`Library: ${scale}, ${bookMetas.length} book(s), ${allPieces.length} piece(s)`)
    return { library, bookData: bookDataList, allPieces }
  }

  // ─── File I/O Helpers ─────────────────────────────────────

  /** Reads every piece directory under `bookDir` into PieceSources. */
  private readPieceSources(bookDir: string): PieceSources[] {
    const sources: PieceSources[] = []
    for (const entry of readdirSync(bookDir).sort()) {
      const pieceDir = join(bookDir, entry)
      const chamPath = join(pieceDir, 'text.cham.md')
      if (!existsSync(chamPath)) continue
      sources.push({
        chamSource: readFileSync(chamPath, 'utf-8'),
        proseFiles: this.readProseFiles(pieceDir),
        layerFiles: this.readLayerFiles(pieceDir),
        partFiles: this.readPartFiles(pieceDir),
      })
    }
    return sources
  }

  private readProseFiles(pieceDir: string): Map<string, string> {
    const files = new Map<string, string>()
    if (!existsSync(pieceDir)) return files
    for (const f of readdirSync(pieceDir)) {
      if (!f.endsWith('.md') || f.endsWith('.cham.md') || f.startsWith('_')) continue
      files.set(f, readFileSync(join(pieceDir, f), 'utf-8'))
    }
    return files
  }

  private readLayerFiles(pieceDir: string): Map<string, string> {
    const files = new Map<string, string>()
    if (!existsSync(pieceDir)) return files
    for (const f of readdirSync(pieceDir)) {
      if (!f.endsWith('.cham.md') || f === 'text.cham.md' || f.startsWith('part-')) continue
      files.set(f, readFileSync(join(pieceDir, f), 'utf-8'))
    }
    return files
  }

  private readPartFiles(pieceDir: string): Map<string, string> {
    const files = new Map<string, string>()
    if (!existsSync(pieceDir)) return files
    for (const f of readdirSync(pieceDir).sort()) {
      if (!f.startsWith('part-') || !f.endsWith('.cham.md')) continue
      files.set(f, readFileSync(join(pieceDir, f), 'utf-8'))
    }
    return files
  }

  // ─── Library scan ─────────────────────────────────────────

  private scanBooks(libraryDir: string): { config: BookConfig; dir: string }[] {
    const books: { config: BookConfig; dir: string }[] = []
    for (const entry of readdirSync(libraryDir).sort()) {
      const dir = join(libraryDir, entry)
      if (!existsSync(join(dir, 'book.yaml'))) continue
      books.push({ config: loadBookConfig(dir), dir })
    }
    return books
  }

  private detectScale(books: { config: BookConfig; dir: string }[]): LibraryScale {
    if (books.length === 0) return 'single-piece'
    if (books.length === 1) {
      let count = 0
      for (const entry of readdirSync(books[0].dir)) {
        if (existsSync(join(books[0].dir, entry, 'text.cham.md'))) count++
      }
      return count <= 1 ? 'single-piece' : 'single-book'
    }
    return 'library'
  }
}

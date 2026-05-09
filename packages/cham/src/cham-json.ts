import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'fs'
import { join, basename, dirname } from 'path'
import { loadYaml } from './yaml.js'
import {
  buildPieceFromCham, buildBookMeta, buildLibraryIndex,
  buildCrossRefs, detectScale,
} from './pipeline.js'
import type {
  BookConfig, BookMeta, BookData, LibraryIndex, LibraryScale,
  OutputPiece, AuthorRecord,
} from './types.js'

// ─── ChamJsonConverter ────────────────────────────────────────

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
    const config = this.loadBookConfig(opts.bookDir)
    const authors = opts.authors || {}
    const pieces: OutputPiece[] = []

    for (const entry of readdirSync(opts.bookDir).sort()) {
      const pieceDir = join(opts.bookDir, entry)
      const chamPath = join(pieceDir, 'text.cham.md')
      if (!existsSync(chamPath)) continue

      const chamSource = readFileSync(chamPath, 'utf-8')
      const proseFiles = this.readProseFiles(pieceDir)
      const layerFiles = this.readLayerFiles(pieceDir)

      const piece = buildPieceFromCham(chamSource, config, authors, config.id, proseFiles, layerFiles)
      if (piece) pieces.push(piece)
    }

    const meta: BookMeta = buildBookMeta(config, pieces.length)
    const bookData: BookData = { meta, pieces }

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

    const authors = opts.authors || {}
    const books = this.scanBooks(opts.libraryDir)
    const scale = this.detectScale(books)

    const allPieces: OutputPiece[] = []
    const bookMetas: BookMeta[] = []
    const bookDataList: BookData[] = []

    for (const { config, dir } of books) {
      const bookOutputDir = join(opts.outputDir, 'books')
      const bookData = this.convertBook({
        bookDir: dir,
        outputDir: bookOutputDir,
        authors,
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
      if (!f.endsWith('.cham.md') || f === 'text.cham.md') continue
      files.set(f, readFileSync(join(pieceDir, f), 'utf-8'))
    }
    return files
  }

  // ─── Book Config ──────────────────────────────────────────

  private loadBookConfig(bookDir: string): BookConfig {
    const raw = this.loadMergedBookYaml(bookDir)
    return {
      id: raw.id as string || basename(bookDir),
      title: raw.title as string || '',
      subtitle: raw.subtitle as string | undefined,
      titleEn: raw.titleEn as string | undefined,
      publisher: raw.publisher as string | undefined,
      genre: raw.genre as BookConfig['genre'],
      contributors: raw.contributors as BookConfig['contributors'],
      date: raw.date as BookConfig['date'],
      hero: raw.hero as string[] | undefined,
      layers: raw.layers as BookConfig['layers'],
      annotation: raw.annotation as BookConfig['annotation'],
    }
  }

  private loadMergedBookYaml(bookDir: string): Record<string, unknown> {
    const configs: Record<string, unknown>[] = []
    let dir = bookDir

    while (dir && dir !== '/' && existsSync(dir)) {
      const yamlPath = join(dir, 'book.yaml')
      if (existsSync(yamlPath)) {
        const raw = loadYaml(yamlPath)
        configs.unshift(raw)
      }
      const parent = dirname(dir)
      if (parent === dir) break
      dir = parent
    }

    return configs.reduce<Record<string, unknown>>((merged, cfg) => ({
      ...merged,
      ...cfg,
      ...(cfg.contributors ? { contributors: cfg.contributors } : {}),
      ...(cfg.date ? { date: { ...(merged.date as Record<string, unknown> || {}), ...cfg.date } } : {}),
      ...(cfg.layers ? { layers: cfg.layers } : {}),
    }), {})
  }

  private scanBooks(libraryDir: string): { config: BookConfig; dir: string }[] {
    const books: { config: BookConfig; dir: string }[] = []
    for (const entry of readdirSync(libraryDir).sort()) {
      const dir = join(libraryDir, entry)
      if (!existsSync(join(dir, 'book.yaml'))) continue
      books.push({ config: this.loadBookConfig(dir), dir })
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

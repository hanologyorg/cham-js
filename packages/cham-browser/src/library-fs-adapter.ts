// ─── Library Filesystem Adapter ────────────────────────────────
// Reads site configuration, book configs, author registry, and piece
// sources from disk. Produces the in-memory inputs that LibraryBuilder
// consumes. The I/O side of the pipeline; cham's LibraryBuilder is the
// pure side.

import { readFileSync, existsSync, readdirSync, statSync } from 'fs'
import { join, resolve } from 'path'
import { parse as parseYaml } from 'yaml'
import {
  LibraryBuilder,
} from '@hanology/cham/pipeline'
import { loadBookConfig } from '@hanology/cham'
import type {
  AuthorRecord, BookConfig, BookSources, PieceSources,
} from '@hanology/cham/types'

// ─── Site Configuration ────────────────────────────────────────

export interface SiteConfig {
  name: string
  nameEn?: string
  subtitle?: string
  subtitleEn?: string
  logo?: string
  logoDark?: string
  aboutFile?: string
  libraryDir: string
  outputDir?: string
  publicDir?: string
  templateDir?: string
  pretty?: boolean
  baseUrl?: string
  favicon?: string
}

/** Reads and parses site config from `config.yaml`. */
export function loadSiteConfig(configPath: string): SiteConfig {
  const raw = parseYaml(readFileSync(configPath, 'utf-8')) as Record<string, unknown>
  return {
    name: String(raw.name ?? ''),
    nameEn: raw.nameEn as string | undefined,
    subtitle: raw.subtitle as string | undefined,
    subtitleEn: raw.subtitleEn as string | undefined,
    logo: raw.logo as string | undefined,
    logoDark: raw.logoDark as string | undefined,
    aboutFile: raw.aboutFile as string | undefined,
    libraryDir: String(raw.libraryDir ?? 'library'),
    outputDir: raw.outputDir as string | undefined,
    publicDir: raw.publicDir as string | undefined,
    templateDir: raw.templateDir as string | undefined,
    pretty: Boolean(raw.pretty),
    baseUrl: raw.baseUrl as string | undefined,
    favicon: raw.favicon as string | undefined,
  }
}

/** Reads and merges book.yaml from `bookDir` and its ancestors. */
export function loadBookConfigFromDir(bookDir: string): BookConfig {
  return loadBookConfig(bookDir)
}

/** Reads the author registry from `authors.yaml` in `configDir`. */
export function loadAuthors(configDir: string): Record<string, AuthorRecord> {
  const authorsPath = join(configDir, 'authors.yaml')
  if (!existsSync(authorsPath)) return {}
  return parseYaml(readFileSync(authorsPath, 'utf-8')) as Record<string, AuthorRecord>
}

/** Reads the about HTML file specified in `config.aboutFile`. */
export function loadAboutHtml(config: SiteConfig, configDir: string): string {
  if (!config.aboutFile) return ''
  const aboutPath = join(configDir, config.aboutFile)
  if (!existsSync(aboutPath)) return ''
  return readFileSync(aboutPath, 'utf-8')
}

// ─── Library & Piece Scanning ──────────────────────────────────

/** Reads all files for a single piece into a PieceSources record. Returns null if no text.cham.md. */
export function readPieceFiles(pieceDir: string): PieceSources | null {
  let chamSource: string | null = null
  const proseFiles = new Map<string, string>()
  const layerFiles = new Map<string, string>()
  const partFiles = new Map<string, string>()

  if (!existsSync(pieceDir)) return null

  for (const f of readdirSync(pieceDir).sort()) {
    const filePath = join(pieceDir, f)
    if (f === 'text.cham.md') {
      chamSource = readFileSync(filePath, 'utf-8')
    } else if (f.startsWith('part-') && f.endsWith('.cham.md')) {
      partFiles.set(f, readFileSync(filePath, 'utf-8'))
    } else if (f.endsWith('.cham.md')) {
      layerFiles.set(f, readFileSync(filePath, 'utf-8'))
    } else if (f.endsWith('.md') && !f.startsWith('_')) {
      proseFiles.set(f, readFileSync(filePath, 'utf-8'))
    }
  }

  if (!chamSource) return null
  return { chamSource, proseFiles, layerFiles, partFiles }
}

/** Walks a book directory and produces PieceSources[] for LibraryBuilder. */
export function scanPieceSources(bookDir: string): PieceSources[] {
  const out: PieceSources[] = []
  if (!existsSync(bookDir)) return out
  for (const entry of readdirSync(bookDir).sort()) {
    const pieceDir = join(bookDir, entry)
    if (!statSync(pieceDir, { throwIfNoEntry: false })?.isDirectory()) continue
    const sources = readPieceFiles(pieceDir)
    if (sources) out.push(sources)
  }
  return out
}

/** Walks a library directory and produces BookSources[] for LibraryBuilder. */
export function scanLibraryBookSources(libraryDir: string): BookSources[] {
  const books: BookSources[] = []
  if (!existsSync(libraryDir)) return books
  for (const entry of readdirSync(libraryDir).sort()) {
    const dir = join(libraryDir, entry)
    if (!statSync(dir, { throwIfNoEntry: false })?.isDirectory()) continue
    if (!existsSync(join(dir, 'book.yaml'))) continue
    books.push({
      config: loadBookConfigFromDir(dir),
      pieces: scanPieceSources(dir),
    })
  }
  return books
}

/** Convenience: scan + build in one call. Returns LibraryData. */
export function loadLibrary(libraryDir: string, authors: Record<string, AuthorRecord>) {
  const bookSources = scanLibraryBookSources(libraryDir)
  return new LibraryBuilder(authors).buildFromBooks(bookSources)
}

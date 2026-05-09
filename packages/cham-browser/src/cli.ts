#!/usr/bin/env node
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync, statSync } from 'fs'
import { join, resolve, dirname, basename } from 'path'
import { fileURLToPath } from 'url'
import { parse as parseYaml } from 'yaml'
import { parseYaml as parseYamlSimple } from '@hanology/cham/yaml'
import {
  buildPieceFromCham, buildBookData, buildLibraryIndex,
  buildAuthorsJson, buildDynastiesJson,
} from './pipeline.js'
import type { AuthorRecord } from './pipeline.js'
import type { BookConfig, BookMeta, OutputPiece, BookData } from '@hanology/cham/types'

// ─── Config ───────────────────────────────────────────────────

interface SiteConfig {
  name: string
  nameEn?: string
  subtitle?: string
  subtitleEn?: string
  libraryDir: string
  authorsFile?: string
  outputDir?: string
  pretty?: boolean
}

function loadConfig(configPath: string): SiteConfig {
  const raw = parseYaml(readFileSync(configPath, 'utf-8')) as Record<string, unknown>
  return {
    name: raw.name as string || 'CHAM',
    nameEn: raw.nameEn as string | undefined,
    subtitle: raw.subtitle as string | undefined,
    subtitleEn: raw.subtitleEn as string | undefined,
    libraryDir: raw.libraryDir as string || 'library/content',
    authorsFile: raw.authorsFile as string | undefined,
    outputDir: raw.outputDir as string || 'dist',
    pretty: raw.pretty as boolean | undefined ?? true,
  }
}

// ─── Book Config ──────────────────────────────────────────────

function loadBookConfig(bookDir: string): BookConfig {
  const raw = parseYaml(readFileSync(join(bookDir, 'book.yaml'), 'utf-8')) as Record<string, unknown>
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

// ─── I/O Adapters ─────────────────────────────────────────────

function loadAuthors(config: SiteConfig, configDir: string): Record<string, AuthorRecord> {
  const defaultPath = join(configDir, 'library', 'data', 'authors.yaml')
  const authorsPath = config.authorsFile
    ? resolve(configDir, config.authorsFile)
    : defaultPath
  if (!existsSync(authorsPath)) return {}
  return parseYaml(readFileSync(authorsPath, 'utf-8')) as Record<string, AuthorRecord>
}

function readPieceFiles(pieceDir: string): {
  chamSource: string | null
  proseFiles: Map<string, string>
  layerFiles: Map<string, string>
} {
  let chamSource: string | null = null
  const proseFiles = new Map<string, string>()
  const layerFiles = new Map<string, string>()

  if (!existsSync(pieceDir)) return { chamSource, proseFiles, layerFiles }

  for (const f of readdirSync(pieceDir)) {
    const filePath = join(pieceDir, f)
    if (f === 'text.cham.md') {
      chamSource = readFileSync(filePath, 'utf-8')
    } else if (f.endsWith('.cham.md')) {
      layerFiles.set(f, readFileSync(filePath, 'utf-8'))
    } else if (f.endsWith('.md') && !f.startsWith('_')) {
      proseFiles.set(f, readFileSync(filePath, 'utf-8'))
    }
  }

  return { chamSource, proseFiles, layerFiles }
}

function scanBooks(libraryDir: string): { config: BookConfig; dir: string }[] {
  const books: { config: BookConfig; dir: string }[] = []
  if (!existsSync(libraryDir)) return books

  for (const entry of readdirSync(libraryDir).sort()) {
    const dir = join(libraryDir, entry)
    if (!statSync(dir, { throwIfNoEntry: false })?.isDirectory()) continue
    if (!existsSync(join(dir, 'book.yaml'))) continue
    books.push({ config: loadBookConfig(dir), dir })
  }
  return books
}

// ─── Data Generation ──────────────────────────────────────────

function generateData(config: SiteConfig, configDir: string): {
  bookMetas: BookMeta[]
  allPieces: OutputPiece[]
} {
  const libraryDir = resolve(configDir, config.libraryDir)
  const authors = loadAuthors(config, configDir)
  const books = scanBooks(libraryDir)

  const allPieces: OutputPiece[] = []
  const bookMetas: BookMeta[] = []
  const bookDataList: BookData[] = []

  for (const { config: bookConfig, dir } of books) {
    const pieces: OutputPiece[] = []

    for (const entry of readdirSync(dir).sort()) {
      const pieceDir = join(dir, entry)
      if (!statSync(pieceDir, { throwIfNoEntry: false })?.isDirectory()) continue
      const { chamSource, proseFiles, layerFiles } = readPieceFiles(pieceDir)
      if (!chamSource) continue

      const piece = buildPieceFromCham(
        chamSource, bookConfig, authors, bookConfig.id,
        proseFiles, layerFiles,
      )
      if (piece) pieces.push(piece)
    }

    const bookData = buildBookData(bookConfig, pieces)
    bookMetas.push(bookData.meta)
    bookDataList.push(bookData)
    allPieces.push(...pieces)
  }

  const library = buildLibraryIndex(bookMetas, allPieces)
  const outputDir = resolve(configDir, config.outputDir || 'dist')
  const dataDir = join(outputDir, 'data')

  mkdirSync(dataDir, { recursive: true })
  mkdirSync(join(dataDir, 'books'), { recursive: true })

  const indent = config.pretty ? 2 : 0

  writeFileSync(
    join(dataDir, 'library.json'),
    JSON.stringify(library, null, indent),
    'utf-8',
  )

  for (const bd of bookDataList) {
    writeFileSync(
      join(dataDir, 'books', `${bd.meta.id}.json`),
      JSON.stringify(bd, null, indent),
      'utf-8',
    )
  }

  const authorsJson = buildAuthorsJson(authors, allPieces)
  writeFileSync(
    join(dataDir, 'authors.json'),
    JSON.stringify(authorsJson, null, indent),
    'utf-8',
  )

  const dynastiesJson = buildDynastiesJson(allPieces)
  writeFileSync(
    join(dataDir, 'dynasties.json'),
    JSON.stringify(dynastiesJson, null, indent),
    'utf-8',
  )

  console.log(`Data: ${bookMetas.length} book(s), ${allPieces.length} piece(s)`)

  return { bookMetas, allPieces }
}

// ─── SSG Build ────────────────────────────────────────────────

async function buildSite(config: SiteConfig, configDir: string): Promise<void> {
  const templateDir = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'template')
  const outputDir = resolve(configDir, config.outputDir || 'dist')

  const { build: ssgBuild } = await import('vite-ssg/node')
  const vue = (await import('@vitejs/plugin-vue')).default

  process.env.CHAM_DATA_DIR = join(outputDir, 'data')

  await ssgBuild(
    {
      script: 'async',
      formatting: 'minify',
      includedRoutes(paths, routes) {
        const result = ['/']

        const library = JSON.parse(
          readFileSync(join(outputDir, 'data', 'library.json'), 'utf-8')
        )
        const authors: { name: string }[] = JSON.parse(
          readFileSync(join(outputDir, 'data', 'authors.json'), 'utf-8')
        )

        for (const book of library.books) {
          result.push(`/${book.id}`)
          const bookData = JSON.parse(
            readFileSync(join(outputDir, 'data', 'books', `${book.id}.json`), 'utf-8')
          )
          for (const piece of bookData.pieces) {
            result.push(`/${book.id}/${piece.num}`)
          }
        }

        for (const a of authors) {
          result.push(`/author/${encodeURIComponent(a.name)}`)
        }

        return result
      },
    },
    {
      root: templateDir,
      plugins: [vue()],
      resolve: {
        alias: {
          '@': resolve(templateDir, 'src'),
        },
      },
      build: {
        outDir: outputDir,
        emptyOutDir: false,
      },
    },
  )

  console.log(`Site built to ${outputDir}`)
}

// ─── Main ─────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2)
  let configPath = 'config.yaml'

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--config' && args[i + 1]) {
      configPath = args[i + 1]
      i++
    }
  }

  if (!existsSync(configPath)) {
    console.error(`Config file not found: ${configPath}`)
    process.exit(1)
  }

  const configDir = dirname(resolve(configPath))
  const config = loadConfig(configPath)

  console.log(`Building site: ${config.name} (${config.nameEn || ''})`)

  // Step 1: Generate JSON data
  generateData(config, configDir)

  // Step 2: Build static site
  await buildSite(config, configDir)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})

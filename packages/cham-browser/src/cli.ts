#!/usr/bin/env node
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync, statSync, cpSync, symlinkSync, rmSync } from 'fs'
import { join, resolve, dirname, basename, sep } from 'path'
import { fileURLToPath } from 'url'
import { parse as parseYaml } from 'yaml'
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
  logo?: string
  logoDark?: string
  aboutFile?: string
  libraryDir: string
  outputDir?: string
  publicDir?: string
  pretty?: boolean
}

function loadConfig(configPath: string): SiteConfig {
  const raw = parseYaml(readFileSync(configPath, 'utf-8')) as Record<string, unknown>
  return {
    name: raw.name as string || 'CHAM',
    nameEn: raw.nameEn as string | undefined,
    subtitle: raw.subtitle as string | undefined,
    subtitleEn: raw.subtitleEn as string | undefined,
    logo: raw.logo as string | undefined,
    logoDark: raw.logoDark as string | undefined,
    aboutFile: raw.aboutFile as string | undefined,
    libraryDir: raw.libraryDir as string || 'library/content',
    outputDir: raw.outputDir as string || 'dist',
    publicDir: raw.publicDir as string | undefined,
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
    'title-en': raw['title-en'] as string | undefined,
    publisher: raw.publisher as string | undefined,
    genre: raw.genre as BookConfig['genre'],
    contributors: raw.contributors as BookConfig['contributors'],
    date: raw.date as BookConfig['date'],
    hero: raw.hero as string[] | undefined,
    layers: raw.layers as BookConfig['layers'],
    annotation: raw.annotation as BookConfig['annotation'],
    hierarchy: raw.hierarchy as BookConfig['hierarchy'],
  }
}

// ─── I/O Adapters ─────────────────────────────────────────────

function loadAuthors(configDir: string): Record<string, AuthorRecord> {
  const authorsDir = join(configDir, 'library', 'authors')
  const indexPath = join(authorsDir, '_index.yaml')
  if (!existsSync(indexPath)) {
    console.warn('No authors/_index.yaml found, authors will be empty')
    return {}
  }

  const indexData = parseYaml(readFileSync(indexPath, 'utf-8')) as { authors: Record<string, string> }
  const personIndex = indexData.authors

  // Build dynasty label → gbCode lookup
  const dynastyToGbCode = new Map<string, string>()
  const dynastiesPath = join(configDir, 'library', 'register', 'dynasties.yaml')
  if (existsSync(dynastiesPath)) {
    const dynasties = parseYaml(readFileSync(dynastiesPath, 'utf-8')) as Array<{
      label: string; names?: string[]; gb_code?: string
    }>
    for (const d of dynasties) {
      if (d.gb_code) {
        dynastyToGbCode.set(d.label, d.gb_code)
        if (d.names) for (const n of d.names) dynastyToGbCode.set(n, d.gb_code)
      }
    }
  }

  const seenDirs = new Set<string>()
  const records: Record<string, AuthorRecord> = {}

  for (const [ref, dirName] of Object.entries(personIndex)) {
    if (seenDirs.has(dirName)) continue
    seenDirs.add(dirName)

    const yamlPath = join(authorsDir, dirName, 'author.yaml')
    if (!existsSync(yamlPath)) continue

    const data = parseYaml(readFileSync(yamlPath, 'utf-8')) as Record<string, unknown>
    const era = (data.dynasty as string) || (data.era as string) || ''
    const eraCode = dynastyToGbCode.get(era) || ''

    let bio = ''
    const bioSources = data.bio_sources as Array<{ file: string }> | undefined
    if (bioSources?.length) {
      const bioFile = join(authorsDir, dirName, bioSources[0].file)
      if (existsSync(bioFile)) {
        bio = readFileSync(bioFile, 'utf-8').replace(/^---\n[\s\S]*?\n---\n/, '').trim()
      }
    }

    const ctextId = typeof data['@id'] === 'string' && data['@id'].startsWith('ctext:')
      ? data['@id'].replace('ctext:', '') : undefined

    records[ref] = {
      name: (data.label as string) || ref,
      dynasty: era,
      era,
      eraCode: eraCode || undefined,
      bio: bio || undefined,
      born: (data['cprop:born'] as { '@value': string })?.['@value'],
      died: (data['cprop:died'] as { '@value': string })?.['@value'],
      courtesyName: data['cprop:name-style'] as string | undefined,
      artName: data['cprop:name-art'] as string | undefined,
      wikidata: data['cprop:authority-wikidata'] as string | undefined,
      ctextId,
      wikipediaZh: data['cprop:link-wikipedia_zh'] as string | undefined,
      wikipediaEn: data['cprop:link-wikipedia_en'] as string | undefined,
    }
  }

  // Map alias refs to the same record
  for (const [ref, dirName] of Object.entries(personIndex)) {
    if (!records[ref]) {
      const canonical = Object.entries(personIndex).find(
        ([r, d]) => d === dirName && records[r],
      )
      if (canonical) records[ref] = records[canonical[0]]
    }
  }

  console.log(`Authors: ${seenDirs.size} directories, ${Object.keys(records).length} refs`)
  return records
}

function loadAboutHtml(config: SiteConfig, configDir: string): string {
  const candidates = [
    config.aboutFile ? resolve(configDir, config.aboutFile) : null,
    join(configDir, 'about.html'),
    join(configDir, 'about.md'),
  ].filter(Boolean) as string[]

  for (const p of candidates) {
    if (existsSync(p)) {
      const content = readFileSync(p, 'utf-8')
      if (p.endsWith('.html')) return content
      return content
    }
  }
  return ''
}

function readPieceFiles(pieceDir: string): {
  chamSource: string | null
  proseFiles: Map<string, string>
  layerFiles: Map<string, string>
  partFiles: Map<string, string>
} {
  let chamSource: string | null = null
  const proseFiles = new Map<string, string>()
  const layerFiles = new Map<string, string>()
  const partFiles = new Map<string, string>()

  if (!existsSync(pieceDir)) return { chamSource, proseFiles, layerFiles, partFiles }

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

  return { chamSource, proseFiles, layerFiles, partFiles }
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
  const authors = loadAuthors(configDir)
  const books = scanBooks(libraryDir)

  const allPieces: OutputPiece[] = []
  const bookMetas: BookMeta[] = []
  const bookDataList: BookData[] = []

  for (const { config: bookConfig, dir } of books) {
    const pieces: OutputPiece[] = []

    for (const entry of readdirSync(dir).sort()) {
      const pieceDir = join(dir, entry)
      if (!statSync(pieceDir, { throwIfNoEntry: false })?.isDirectory()) continue
      const { chamSource, proseFiles, layerFiles, partFiles } = readPieceFiles(pieceDir)
      if (!chamSource) continue

      const piece = buildPieceFromCham(
        chamSource, bookConfig, authors, bookConfig.id,
        proseFiles, layerFiles, partFiles,
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
  mkdirSync(join(dataDir, 'pieces'), { recursive: true })
  mkdirSync(join(dataDir, 'authors'), { recursive: true })

  const indent = config.pretty ? 2 : 0

  // library.json
  writeFileSync(
    join(dataDir, 'library.json'),
    JSON.stringify(library, null, indent),
    'utf-8',
  )

  // Per-book data (full + meta)
  for (const bd of bookDataList) {
    writeFileSync(
      join(dataDir, 'books', `${bd.meta.id}.json`),
      JSON.stringify(bd, null, indent),
      'utf-8',
    )
    writeFileSync(
      join(dataDir, 'books', `${bd.meta.id}.meta.json`),
      JSON.stringify(bd.meta, null, indent),
      'utf-8',
    )
  }

  // Piece index (lightweight summaries for ALL pieces)
  const pieceIndex = allPieces.map(p => ({
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
  writeFileSync(
    join(dataDir, 'index.json'),
    JSON.stringify(pieceIndex, null, indent),
    'utf-8',
  )

  // Per-piece JSON files
  for (const piece of allPieces) {
    const pieceDir = join(dataDir, 'pieces', piece.bookId)
    mkdirSync(pieceDir, { recursive: true })
    writeFileSync(join(pieceDir, `${piece.num}.json`), JSON.stringify(piece, null, indent), 'utf-8')
  }

  // Per-author split data
  const workCounts = new Map<string, { works: string[]; era: string; eraCode: string }>()
  for (const p of allPieces) {
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
  for (const [ref, data] of Object.entries(authors)) {
    if (!data.name) continue
    const wc = workCounts.get(ref)
    const entry = {
      id: ref,
      name: data.name,
      era: wc?.era || data.era || data.dynasty || '',
      eraCode: wc?.eraCode || data.eraCode || '',
      workCount: wc?.works.length || 0,
    }
    authorIndex.push(entry)

    // Per-author detail JSON
    writeFileSync(
      join(dataDir, 'authors', `${ref}.json`),
      JSON.stringify({
        ...entry,
        names: [],
        bio: data.bio || '',
        bioSource: '',
        ctext: data.ctextId ? Number(data.ctextId) : undefined,
        wikidata: data.wikidata,
        wikipediaZh: data.wikipediaZh,
        wikipediaEn: data.wikipediaEn,
        works: wc?.works || [],
      }, null, indent),
      'utf-8',
    )
  }
  writeFileSync(join(dataDir, 'authors', 'index.json'), JSON.stringify(authorIndex, null, indent), 'utf-8')

  // Dynasties/eras (using era field)
  const dynastiesJson = buildDynastiesJson(allPieces)
  writeFileSync(
    join(dataDir, 'dynasties.json'),
    JSON.stringify(dynastiesJson, null, indent),
    'utf-8',
  )

  console.log(`Data: ${bookMetas.length} book(s), ${allPieces.length} piece(s), ${authorIndex.length} author(s)`)

  return { bookMetas, allPieces }
}

// ─── Shared Vite Config ───────────────────────────────────────

function getPackageVersions(): { cham: string; chamBrowser: string } {
  const thisDir = dirname(fileURLToPath(import.meta.url))
  const browserPkg = JSON.parse(readFileSync(join(thisDir, '..', 'package.json'), 'utf-8'))
  let chamVersion = ''
  const candidates = [
    // workspace layout: dist/ → cham-browser/ → packages/ → root/packages/cham/
    join(thisDir, '..', '..', '..', 'packages', 'cham', 'package.json'),
    // npm hoisted: @hanology/cham-browser/dist → @hanology/cham-browser/ → node_modules/@hanology/cham/
    join(thisDir, '..', '..', 'cham', 'package.json'),
    // npm nested
    join(thisDir, '..', 'node_modules', '@hanology', 'cham', 'package.json'),
  ]
  for (const p of candidates) {
    try {
      chamVersion = JSON.parse(readFileSync(p, 'utf-8')).version
      break
    } catch { /* next */ }
  }
  return { cham: chamVersion, chamBrowser: browserPkg.version }
}

function getTemplateDir(): string {
  return resolve(dirname(fileURLToPath(import.meta.url)), '..', 'template')
}

function copyLogos(config: SiteConfig, configDir: string, outputDir: string): { logoUrl: string | undefined; logoDarkUrl: string | undefined } {
  function copyLogo(key: string, rawPath: string | undefined): string | undefined {
    if (!rawPath) return undefined
    const src = resolve(configDir, rawPath)
    if (!existsSync(src)) { console.warn(`Logo not found: ${src}`); return undefined }
    const assetsDir = join(outputDir, 'assets')
    mkdirSync(assetsDir, { recursive: true })
    const ext = src.endsWith('.svg') ? 'svg' : src.endsWith('.png') ? 'png' : 'bin'
    const name = `logo-${key}.${ext}`
    writeFileSync(join(assetsDir, name), readFileSync(src))
    const url = `/assets/${name}`
    console.log(`Logo (${key}): ${rawPath} → ${url}`)
    return url
  }
  const logoUrl = copyLogo('light', config.logo)
  const logoDarkUrl = copyLogo('dark', config.logoDark)
  return { logoUrl, logoDarkUrl }
}

function getSiteMeta(config: SiteConfig, configDir: string) {
  return {
    siteTitle: config.subtitle || config.name,
    siteSubtitle: config.subtitleEn || config.nameEn || '',
    aboutHtml: loadAboutHtml(config, configDir),
  }
}

function chamHtmlPlugin(siteTitle: string, logoUrl?: string) {
  return {
    name: 'cham-html-transform',
    enforce: 'post' as const,
    transformIndexHtml: {
      order: 'post' as const,
      handler(html: string) {
        let result = html.replace(/<title>CHAM<\/title>/, `<title>${siteTitle}</title>`)
        result = result.replace(/<html\s+lang="en"/, '<html lang="zh-Hant"')
        if (logoUrl) {
          result = result.replace(
            'id="loading-logo"></div>',
            `id="loading-logo"><img src="${logoUrl}" alt="" class="ld-base" /><div class="ld-liquid"><img src="${logoUrl}" alt="" class="ld-fill" /></div></div>`
          )
        }
        return result
      },
    },
  }
}

// ─── Dev Server ───────────────────────────────────────────────

async function devServer(config: SiteConfig, configDir: string): Promise<void> {
  const templateDir = getTemplateDir()
  const outputDir = resolve(configDir, config.outputDir || 'dist')

  // Step 1: Generate data
  generateData(config, configDir)

  const { logoUrl, logoDarkUrl } = copyLogos(config, configDir, outputDir)
  const { siteTitle, siteSubtitle, aboutHtml } = getSiteMeta(config, configDir)

  // Symlink data dir into template's public so vite dev serves it
  const templatePublicData = join(templateDir, 'public', 'data')
  const dataDir = join(outputDir, 'data')
  rmSync(templatePublicData, { recursive: true, force: true })
  mkdirSync(dirname(templatePublicData), { recursive: true })
  symlinkSync(dataDir, templatePublicData)
  console.log(`Data: ${dataDir} → ${templatePublicData}`)

  // Symlink bundled fonts into template's public
  const bundledFonts = join(templateDir, '..', 'fonts')
  if (existsSync(bundledFonts)) {
    const templateFonts = join(templateDir, 'public', 'fonts')
    rmSync(templateFonts, { recursive: true, force: true })
    symlinkSync(bundledFonts, templateFonts)
    console.log(`Fonts: ${bundledFonts} → ${templateFonts}`)
  }

  // Symlink public assets (favicons etc.) into template's public
  const publicDir = config.publicDir
    ? resolve(configDir, config.publicDir)
    : resolve(configDir, 'public')
  if (existsSync(publicDir)) {
    for (const f of readdirSync(publicDir).sort()) {
      if (f === 'data') continue
      const src = join(publicDir, f)
      const dest = join(templateDir, 'public', f)
      rmSync(dest, { recursive: true, force: true })
      symlinkSync(src, dest)
    }
    console.log(`Public assets linked from ${publicDir}`)
  }

  // Symlink logo assets into template's public/assets
  const templatePublicAssets = join(templateDir, 'public', 'assets')
  const distAssets = join(outputDir, 'assets')
  if (existsSync(distAssets)) {
    mkdirSync(templatePublicAssets, { recursive: true })
    for (const f of readdirSync(distAssets)) {
      const src = join(distAssets, f)
      const dest = join(templatePublicAssets, f)
      rmSync(dest, { force: true })
      symlinkSync(src, dest)
    }
  }

  process.env.CHAM_DATA_DIR = dataDir

  const versions = getPackageVersions()
  const vite = await import('vite')
  const vue = (await import('@vitejs/plugin-vue')).default

  const server = await vite.createServer({
    root: templateDir,
    plugins: [vue(), chamHtmlPlugin(siteTitle, logoUrl)],
    resolve: {
      alias: {
        '@': resolve(templateDir, 'src'),
      },
    },
    define: {
      'import.meta.env.CHAM_LOGO_URL': JSON.stringify(logoUrl || ''),
      'import.meta.env.CHAM_LOGO_DARK_URL': JSON.stringify(logoDarkUrl || ''),
      'import.meta.env.CHAM_SITE_TITLE': JSON.stringify(siteTitle),
      'import.meta.env.CHAM_SITE_SUBTITLE': JSON.stringify(siteSubtitle),
      'import.meta.env.CHAM_ABOUT_HTML': JSON.stringify(aboutHtml),
      'import.meta.env.CHAM_VERSION': JSON.stringify(versions.cham),
      'import.meta.env.CHAM_BROWSER_VERSION': JSON.stringify(versions.chamBrowser),
    },
    server: {
      port: 3000,
      open: true,
    },
  })

  await server.listen()
  server.printUrls()
}

// ─── SSG Build ────────────────────────────────────────────────

async function buildSite(config: SiteConfig, configDir: string): Promise<void> {
  const templateDir = getTemplateDir()
  const outputDir = resolve(configDir, config.outputDir || 'dist')

  const { logoUrl, logoDarkUrl } = copyLogos(config, configDir, outputDir)
  const { siteTitle, siteSubtitle, aboutHtml } = getSiteMeta(config, configDir)

  // Symlink bundled fonts into template's public
  const bundledFonts = join(templateDir, '..', 'fonts')
  if (existsSync(bundledFonts)) {
    const templatePublic = join(templateDir, 'public')
    const templateFonts = join(templatePublic, 'fonts')
    rmSync(templateFonts, { recursive: true, force: true })
    mkdirSync(templatePublic, { recursive: true })
    symlinkSync(bundledFonts, templateFonts)
    console.log(`Fonts: ${bundledFonts} → ${templateFonts}`)
  }

  const { build: ssgBuild } = await import('vite-ssg/node')
  const vue = (await import('@vitejs/plugin-vue')).default

  process.env.CHAM_DATA_DIR = join(outputDir, 'data')
  const versions = getPackageVersions()

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
          readFileSync(join(outputDir, 'data', 'authors', 'index.json'), 'utf-8')
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
      plugins: [vue(), chamHtmlPlugin(siteTitle, logoUrl)],
      resolve: {
        alias: {
          '@': resolve(templateDir, 'src'),
        },
      },
      define: {
        'import.meta.env.CHAM_LOGO_URL': JSON.stringify(logoUrl || ''),
        'import.meta.env.CHAM_LOGO_DARK_URL': JSON.stringify(logoDarkUrl || ''),
        'import.meta.env.CHAM_SITE_TITLE': JSON.stringify(siteTitle),
        'import.meta.env.CHAM_SITE_SUBTITLE': JSON.stringify(siteSubtitle),
        'import.meta.env.CHAM_ABOUT_HTML': JSON.stringify(aboutHtml),
        'import.meta.env.CHAM_VERSION': JSON.stringify(versions.cham),
        'import.meta.env.CHAM_BROWSER_VERSION': JSON.stringify(versions.chamBrowser),
      },
      build: {
        outDir: outputDir,
        emptyOutDir: false,
      },
    },
  )

  console.log(`Site built to ${outputDir}`)

  // Copy public dir assets (favicons, manifest, etc.) to output
  const publicDir = config.publicDir
    ? resolve(configDir, config.publicDir)
    : resolve(configDir, 'public')
  if (existsSync(publicDir)) {
    cpSync(publicDir, outputDir, { recursive: true, filter: (src) => !src.endsWith('.html') && !src.includes(`${sep}data`) })
    console.log(`Public: ${publicDir} → ${outputDir}`)
  }
}

// ─── Main ─────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2)
  let configPath = 'config.yaml'
  let command = 'build'

  if (args[0] === 'dev' || args[0] === 'build') {
    command = args.shift()!
  }

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

  console.log(`Site: ${config.name} (${config.nameEn || ''})`)

  if (command === 'dev') {
    await devServer(config, configDir)
  } else {
    console.log(`Building site: ${config.name} (${config.nameEn || ''})`)
    // Step 1: Generate JSON data
    generateData(config, configDir)
    // Step 2: Build static site
    await buildSite(config, configDir)
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})

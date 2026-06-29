#!/usr/bin/env node
import { readFileSync, readdirSync, existsSync, mkdirSync, cpSync, symlinkSync, rmSync } from 'fs'
import { join, resolve, dirname, sep } from 'path'
import { fileURLToPath } from 'url'
import {
  loadSiteConfig, loadAuthors, loadAboutHtml, scanLibraryBookSources,
  type SiteConfig,
} from './library-fs-adapter.js'
import { SiteWriter } from './site-writer.js'
import { LibraryBuilder } from './pipeline.js'

// ─── Data Generation ──────────────────────────────────────────

function generateData(config: SiteConfig, configDir: string): void {
  const libraryDir = resolve(configDir, config.libraryDir)
  const authors = loadAuthors(configDir)
  const bookSources = scanLibraryBookSources(libraryDir)
  const data = new LibraryBuilder(authors).buildFromBooks(bookSources)

  const writer = new SiteWriter({
    outputDir: resolve(configDir, config.outputDir || 'dist'),
    pretty: config.pretty,
  })
  const result = writer.writeAll(data, authors)
  console.log(`Data: ${result.bookCount} book(s), ${result.pieceCount} piece(s), ${result.authorCount} author(s)`)
}

// ─── Shared Vite Config ───────────────────────────────────────

function getPackageVersions(): { cham: string; chamBrowser: string } {
  const thisDir = dirname(fileURLToPath(import.meta.url))
  const browserPkg = JSON.parse(readFileSync(join(thisDir, '..', 'package.json'), 'utf-8'))
  let chamVersion = ''
  const candidates = [
    join(thisDir, '..', '..', '..', 'packages', 'cham', 'package.json'),
    join(thisDir, '..', '..', 'cham', 'package.json'),
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
  const thisDir = dirname(fileURLToPath(import.meta.url))
  return join(thisDir, '..', 'template')
}

function copyLogos(config: SiteConfig, configDir: string, outputDir: string): { logoUrl: string | undefined; logoDarkUrl: string | undefined } {
  const logoUrl = config.logo
    ? copyAsset(config.logo, configDir, outputDir)
    : undefined
  const logoDarkUrl = config.logoDark
    ? copyAsset(config.logoDark, configDir, outputDir)
    : undefined
  return { logoUrl, logoDarkUrl }
}

function copyAsset(relPath: string, configDir: string, outputDir: string): string | undefined {
  const src = resolve(configDir, relPath)
  if (!existsSync(src)) return undefined
  const dest = join(outputDir, 'assets', relPath)
  mkdirSync(dirname(dest), { recursive: true })
  cpSync(src, dest)
  return `assets/${relPath}`
}

function getSiteMeta(config: SiteConfig, configDir: string) {
  const aboutHtml = loadAboutHtml(config, configDir)
  return {
    siteTitle: config.name,
    siteSubtitle: config.subtitle || '',
    aboutHtml,
  }
}

function chamHtmlPlugin(siteTitle: string, logoUrl?: string) {
  return {
    name: 'cham-html-transform',
    transformIndexHtml(html: string) {
      if (logoUrl) html = html.replace(/<link rel="icon"[^>]*>/, '')
      html = html.replace('<title>', `<title>${siteTitle} — `).replace(` — ${siteTitle}</title>`, '</title>')
      if (siteTitle && !html.includes('<title>')) html = html.replace('<head>', `<head><title>${siteTitle}</title>`)
      return html
    },
  }
}

// ─── Dev Server ───────────────────────────────────────────────

async function devServer(config: SiteConfig, configDir: string): Promise<void> {
  const templateDir = getTemplateDir()
  const outputDir = resolve(configDir, config.outputDir || 'dist')

  generateData(config, configDir)

  const { logoUrl, logoDarkUrl } = copyLogos(config, configDir, outputDir)
  const { siteTitle, siteSubtitle, aboutHtml } = getSiteMeta(config, configDir)

  const templatePublicData = join(templateDir, 'public', 'data')
  const dataDir = join(outputDir, 'data')
  rmSync(templatePublicData, { recursive: true, force: true })
  mkdirSync(dirname(templatePublicData), { recursive: true })
  symlinkSync(dataDir, templatePublicData)
  console.log(`Data: ${dataDir} → ${templatePublicData}`)

  const bundledFonts = join(templateDir, '..', 'fonts')
  if (existsSync(bundledFonts)) {
    const templateFonts = join(templateDir, 'public', 'fonts')
    rmSync(templateFonts, { recursive: true, force: true })
    symlinkSync(bundledFonts, templateFonts)
    console.log(`Fonts: ${bundledFonts} → ${templateFonts}`)
  }

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

  generateData(config, configDir)

  const { logoUrl, logoDarkUrl } = copyLogos(config, configDir, outputDir)
  const { siteTitle, siteSubtitle, aboutHtml } = getSiteMeta(config, configDir)

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
  const config = loadSiteConfig(configPath)

  console.log(`Site: ${config.name} (${config.nameEn || ''})`)

  if (command === 'dev') {
    await devServer(config, configDir)
  } else {
    await buildSite(config, configDir)
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})

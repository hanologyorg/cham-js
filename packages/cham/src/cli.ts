#!/usr/bin/env node
import { resolve, basename } from 'path'
import { EpubConverter } from './epub.js'

// ─── Minimal Arg Parser ────────────────────────────────────────

interface CliArgs {
  epubPath?: string
  outputDir?: string
  id?: string
  title?: string
  subtitle?: string
  titleEn?: string
  genre?: string
  contributors?: string[]   // "ref:role" format
  layerContributor?: string
  dynasty?: string
  era?: string
  eraYear?: string
  help?: boolean
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {}
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--help' || arg === '-h') { args.help = true; continue }
    if (!arg.startsWith('--')) {
      if (!args.epubPath) args.epubPath = arg
      else if (!args.outputDir) args.outputDir = arg
      continue
    }
    const eq = arg.indexOf('=')
    const key = eq !== -1 ? arg.slice(2, eq) : arg.slice(2)
    const val = eq !== -1 ? arg.slice(eq + 1) : argv[++i]
    switch (key) {
      case 'id': args.id = val; break
      case 'title': args.title = val; break
      case 'subtitle': args.subtitle = val; break
      case 'title-en': args.titleEn = val; break
      case 'genre': args.genre = val; break
      case 'contributor': (args.contributors ??= []).push(val); break
      case 'layer-contributor': args.layerContributor = val; break
      case 'dynasty': args.dynasty = val; break
      case 'era': args.era = val; break
      case 'era-year': args.eraYear = val; break
      case 'output': args.outputDir = val; break
      default: console.error(`Unknown option: --${key}`); process.exit(1)
    }
  }
  return args
}

function printHelp(): void {
  console.log(`
@hanology/cham — CHAM ePub Converter

Usage:
  cham-epub <epub-path> [output-dir] [options]

Options:
  --id <string>             Book ID (auto-derived if omitted)
  --title <string>          Book title (auto-derived from filename)
  --subtitle <string>       Subtitle (e.g. 四庫全書本)
  --title-en <string>       English title
  --genre <string>          Genre: prose | poetry | mixed | drama (default: prose)
  --contributor <ref:role>  Contributor, repeatable (e.g. "唐太宗:author")
  --layer-contributor <id>  Commentary layer contributor (e.g. 四庫全書館臣)
  --dynasty <string>        Dynasty (e.g. 唐)
  --era <string>            Era name (e.g. 貞觀)
  --era-year <number>       Year within era
  --output <dir>            Output directory (default: ./output)
  -h, --help                Show this help

Examples:
  cham-epub 帝學_\\(四庫全書本\\).epub --id skqs-dixue --title 帝學 \\
    --subtitle 四庫全書本 --title-en "The Imperial Learning (Siku Quanshu Edition)" \\
    --contributor "宋太宗:author" --layer-contributor 四庫全書館臣 \\
    --dynasty 宋 --output ../library/content/skqs-dixue

Auto-derivation from filename:
  "帝學_(四庫全書本).epub" → id: skqs-dixue, title: 帝學, subtitle: 四庫全書本
`)
}

// ─── Auto-derivation ────────────────────────────────────────────

function deriveFromFilename(filename: string): Partial<CliArgs> {
  const stem = filename.replace(/\.epub$/, '')
  const skqsMatch = stem.match(/^(.+?)_\(四庫全書本\)$/)
  if (skqsMatch) {
    const title = skqsMatch[1]
    const id = 'skqs-' + pinyin(title)
    return { id, title, subtitle: '四庫全書本', genre: 'prose', layerContributor: '四庫全書館臣' }
  }
  return { title: stem, genre: 'prose' }
}

// Known title-to-slug mapping. Pass --id to override for unlisted titles.
const TITLE_SLUGS: Record<string, string> = {
  '帝學': 'dixue', '文子': 'wenzi', '孟子注疏': 'mengzi-zhushu',
  '尹文子': 'yinwenzi', '鹽鐵論': 'yantielun', '鬼谷子': 'guiguzi',
  '帝範': 'difan', '臣軌': 'shengui', '孟子': 'mengzi', '荀子': 'xunzi',
  '家範': 'jiafan', '家語': 'jiayu', '鶡冠子': 'heguanzi',
  '揚子法言': 'yangzi-fayan', '握竒經': 'woqijing',
  '太上老君說常清靜經': 'qingjing-jing', '黃帝四經': 'huangdi-sijing',
  '老子': 'laozi', '老子（帛書校勘版）': 'laozi-boshu',
  '道德經（王弼本）': 'daodejing-wangbi', '老子河上公章句': 'laozi-heshanggong',
  '唐玄宗御註道德真經': 'daodejing-xuanzong',
}

function pinyin(title: string): string {
  const slug = TITLE_SLUGS[title]
  if (slug) return slug
  const fallback = title.toLowerCase().replace(/[^\w-]/g, '-')
  console.warn(`Warning: no slug mapping for "${title}", using "${fallback}". Pass --id to override.`)
  return fallback
}

// ─── Main ───────────────────────────────────────────────────────

const args = parseArgs(process.argv)

if (args.help) { printHelp(); process.exit(0) }
if (!args.epubPath) {
  console.error('Error: epub path required. Use --help for usage.')
  process.exit(1)
}

const epubPath = resolve(args.epubPath)
const derived = deriveFromFilename(basename(epubPath))

const id = args.id || derived.id || 'unknown'
const title = args.title || derived.title || basename(epubPath, '.epub')
const subtitle = args.subtitle || derived.subtitle
const titleEn = args.titleEn
const genre = (args.genre || derived.genre || 'prose') as 'prose' | 'poetry' | 'mixed' | 'drama'
const layerContributor = args.layerContributor || derived.layerContributor

const contributors = (args.contributors || []).map(c => {
  const i = c.lastIndexOf(':')
  return { ref: c.slice(0, i), role: c.slice(i + 1) as 'author' | 'editor' | 'annotator' | 'translator' }
})

const date: Record<string, unknown> = {}
if (args.dynasty) date.dynasty = args.dynasty
if (args.era) date.era = args.era
if (args.eraYear) date.era_year = parseInt(args.eraYear, 10)

const outputDir = resolve(args.outputDir || args.outputDir || `./output/${id}`)

const converter = new EpubConverter()
converter.convert({
  epubPath,
  outputDir,
  bookConfig: {
    id,
    title,
    subtitle,
    'title-en': titleEn,
    genre,
    contributors: contributors.length > 0 ? contributors : undefined,
    date: Object.keys(date).length > 0 ? date as any : undefined,
  },
  layerContributor,
})

console.log(`\nDone: ${epubPath} → ${outputDir}`)

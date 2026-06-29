// ─── Commentary Layer Splitter ─────────────────────────────────
// Migration tool: splits a multi-scholar commentary.cham.md into
// per-scholar files using external text-quote references.
//
// The scholar map is BOOK-SPECIFIC: each book has its own
// scholar-map.yaml in its root directory, naming the scholars that
// appear in that edition's commentary.
//
// Usage:
//   npx tsx scripts/split-commentary-layers.ts <piece-dir>
//   npx tsx scripts/split-commentary-layers.ts <piece-dir> --dry-run
//   npx tsx scripts/split-commentary-layers.ts <piece-dir> --clean-text
//
// Map discovery (in order):
//   1. --map <path.yaml> command-line argument
//   2. scholar-map.yaml in the piece's book directory (../../scholar-map.yaml)
//
// Map format (YAML):
//   # Optional default for unmatched annotations
//   default: yanshigu
//
//   郭曰:
//     file: guopu
//     contributor: C020
//     role: annotator
//     nature: zhu
//     label: 郭璞注
//     shortLabel: 郭
//     stripPrefix: true

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'fs'
import { join, basename, resolve, dirname } from 'path'
import { parse, serialize, type ChamDocument, type AnnotationEntry, type AnnotationSection } from '../src/index.js'
import { parseYaml } from '../src/yaml.js'
import { asRecord, pickString, pickBoolean } from '../src/yaml-typer.js'

export interface ScholarMapping {
  readonly file: string
  readonly contributor: string
  readonly role: string
  readonly nature: string
  readonly label: string
  readonly shortLabel: string
  readonly stripPrefix: boolean
}

export interface ScholarMap {
  /** Prefix-keyed mappings. */
  readonly scholars: Record<string, ScholarMapping>
  /** Optional: route unmatched annotations to this scholar file. */
  readonly default?: string
}

export interface SplitOptions {
  readonly dryRun?: boolean
  readonly keepOriginal?: boolean
  /** Also rewrite text.cham.md without {N}...{/N} markers. */
  readonly cleanText?: boolean
}

export interface SplitResult {
  readonly outputs: Record<string, string>
  readonly unmatched: AnnotationEntry[]
  readonly counts: Record<string, number>
  /** If cleanText was requested, the cleaned primary text. */
  readonly cleanedText?: string
}

export function loadScholarMap(path: string): ScholarMap {
  const top = asRecord(parseYaml(readFileSync(path, 'utf-8')))
  if (!top) {
    throw new Error(`scholar-map.yaml at ${path} is not a YAML mapping`)
  }
  const scholars: Record<string, ScholarMapping> = {}
  let defaultFile: string | undefined

  for (const [key, val] of Object.entries(top)) {
    if (key === 'default') {
      defaultFile = pickString(top, 'default')
      continue
    }
    const m = asRecord(val)
    if (!m) continue
    const file = pickString(m, 'file')
    const contributor = pickString(m, 'contributor')
    const role = pickString(m, 'role')
    const nature = pickString(m, 'nature')
    const label = pickString(m, 'label')
    const shortLabel = pickString(m, 'shortLabel')
    if (!file || !contributor || !role || !nature || !label || !shortLabel) {
      throw new Error(`scholar-map.yaml entry "${key}" is missing required fields`)
    }
    scholars[key] = {
      file,
      contributor,
      role,
      nature,
      label,
      shortLabel,
      stripPrefix: pickBoolean(m, 'stripPrefix') ?? true,
    }
  }
  return { scholars, ...(defaultFile ? { default: defaultFile } : {}) }
}

/**
 * Splits a compound annotation entry at 　(full-width space) boundaries
 * where the NEXT segment starts with a known scholar prefix.
 *
 * This is "Pattern A: Scholar boundary" from migration-patterns.md.
 * Other patterns (B: variant+commentary, C: formatting artifact,
 * D: placeholder) are preserved as part of the current segment.
 */
function splitCompoundEntry(
  entry: AnnotationEntry,
  scholars: Record<string, ScholarMapping>,
): AnnotationEntry[] {
  if (!entry.value.includes('　')) return [entry]

  const prefixes = Object.keys(scholars).sort((a, b) => b.length - a.length)
  if (prefixes.length === 0) return [entry]

  // Walk the string; split at 　 only when followed by a scholar prefix.
  const segments: string[] = []
  let current = ''
  let i = 0
  const v = entry.value
  while (i < v.length) {
    if (v[i] === '　') {
      const rest = v.slice(i + 1)
      if (prefixes.some(p => rest.startsWith(p))) {
        if (current) segments.push(current)
        current = ''
        i++
        continue
      }
    }
    current += v[i]
    i++
  }
  if (current) segments.push(current)

  if (segments.length <= 1) return [entry]
  return segments.map(value => ({ ...entry, value }))
}

/**
 * Splits a parsed commentary document into per-scholar documents.
 * Routes each annotation by scholar prefix; unmatched annotations go
 * to the default scholar if configured.
 */
export function splitCommentaryByScholar(
  commentaryDoc: ChamDocument,
  primaryDoc: ChamDocument,
  map: ScholarMap,
  _options: SplitOptions = {},
): SplitResult {
  const entriesByFile = new Map<string, { entries: AnnotationEntry[]; mapping: ScholarMapping }>()
  const counts: Record<string, number> = {}
  const unmatched: AnnotationEntry[] = []

  // Initialize default bucket if configured
  if (map.default) {
    const defaultMapping = Object.values(map.scholars).find(s => s.file === map.default)
    if (defaultMapping) {
      entriesByFile.set(map.default, { entries: [], mapping: defaultMapping })
    }
  }

  for (const section of commentaryDoc.sections) {
    for (const entry of section.entries) {
      // Pre-split compound entries at 　boundaries where the next segment
      // starts with a known scholar prefix (Pattern A: scholar boundary).
      const segments = splitCompoundEntry(entry, map.scholars)

      for (const segment of segments) {
        const matchedPrefix = findScholarPrefix(segment.value, map.scholars)
        let mapping: ScholarMapping | undefined
        let newEntry: AnnotationEntry
        let countKey: string

        if (matchedPrefix) {
          mapping = map.scholars[matchedPrefix]
          newEntry = transformEntry(segment, matchedPrefix, mapping, primaryDoc)
          countKey = matchedPrefix
        } else if (map.default) {
          const bucket = entriesByFile.get(map.default)
          if (!bucket) { unmatched.push(segment); continue }
          mapping = bucket.mapping
          newEntry = transformEntry(segment, '', mapping, primaryDoc)
          countKey = `(default→${map.default})`
        } else {
          unmatched.push(segment)
          continue
        }

        const file = mapping.file
        let bucket = entriesByFile.get(file)
        if (!bucket) {
          bucket = { entries: [], mapping }
          entriesByFile.set(file, bucket)
        }
        bucket.entries.push(newEntry)
        counts[countKey] = (counts[countKey] || 0) + 1
      }
    }
  }

  const serialized: Record<string, string> = {}
  for (const [file, { entries, mapping }] of entriesByFile) {
    if (entries.length === 0) continue
    serialized[file] = serializeScholarDoc(entries, mapping, sectionMeta(commentaryDoc))
  }

  return { outputs: serialized, unmatched, counts }
}

/** Finds the longest matching scholar prefix in a value string. */
function findScholarPrefix(
  value: string,
  scholars: Record<string, ScholarMapping>,
): string | null {
  const prefixes = Object.keys(scholars).sort((a, b) => b.length - a.length)
  for (const prefix of prefixes) {
    if (value.startsWith(prefix)) return prefix
  }
  return null
}

/** Transforms an entry: strips prefix, converts marker→text target. */
function transformEntry(
  entry: AnnotationEntry,
  prefix: string,
  mapping: ScholarMapping,
  primaryDoc: ChamDocument,
): AnnotationEntry {
  let value = entry.value
  if (prefix && mapping.stripPrefix) {
    value = value.slice(prefix.length)
  }
  const target = convertMarkerToTextQuote(entry.target, primaryDoc)
  return { ...entry, target, value }
}

/**
 * Converts a marker target to a text-quote target using marker.text.
 * For zero-width markers (no text), falls back to @v:N (entire verse).
 */
function convertMarkerToTextQuote(
  target: AnnotationEntry['target'],
  primaryDoc: ChamDocument,
): AnnotationEntry['target'] {
  if (target.type !== 'marker') return target
  const marker = primaryDoc.markers.get(target.markerId)
  if (!marker) return target

  // Zero-width marker → use verse-all target on the marker's verse
  if (marker.length === 0 || !marker.text) {
    return { type: 'verse-all', line: marker.blockIndex }
  }

  // Normal marker → use text-quote with the marker's text
  return { type: 'text', quote: marker.text }
}

function sectionMeta(doc: ChamDocument): Pick<AnnotationSection['meta'], 'nature'> {
  if (doc.sections.length === 0) return {}
  return { nature: doc.sections[0].meta.nature }
}

function serializeScholarDoc(
  entries: AnnotationEntry[],
  mapping: ScholarMapping,
  inheritedMeta: Pick<AnnotationSection['meta'], 'nature'>,
): string {
  const section: AnnotationSection = {
    name: '注釋',
    meta: {
      contributor: mapping.contributor,
      role: mapping.role,
      nature: mapping.nature || inheritedMeta.nature,
    },
    entries,
  }
  const doc: ChamDocument = {
    meta: {
      type: 'secondary',
      base: 'text.cham.md',
      contributor: mapping.contributor,
      role: mapping.role,
      nature: mapping.nature || inheritedMeta.nature,
    },
    textBlocks: [],
    markers: new Map(),
    sections: [section],
  }
  return serialize(doc)
}

// ─── Primary Text Cleaning ─────────────────────────────────────

/**
 * Strips all {N}...{/N} markers from a primary document, producing
 * clean text. The markers are no longer needed once all commentary
 * references use @[quote] text-quotes.
 *
 * Returns the serialized clean text document.
 */
export function cleanPrimaryTextMarkers(primaryDoc: ChamDocument): string {
  const cleaned: ChamDocument = {
    ...primaryDoc,
    markers: new Map(),
    textBlocks: primaryDoc.textBlocks.map(b => ({
      ...b,
      // Source still has markers — strip them for the clean version
      source: b.text,
      display: b.text,
    })),
  }
  return serialize(cleaned)
}

// ─── CLI ───────────────────────────────────────────────────────

function findScholarMap(pieceDir: string, explicitPath?: string): string {
  if (explicitPath) {
    const resolved = resolve(explicitPath)
    if (!existsSync(resolved)) {
      console.error(`Error: scholar map not found: ${resolved}`)
      process.exit(1)
    }
    return resolved
  }

  const bookDir = dirname(pieceDir)
  const candidate = join(bookDir, 'scholar-map.yaml')
  if (existsSync(candidate)) return candidate

  console.error(`Error: no scholar-map.yaml found in ${bookDir}`)
  console.error(`Create one (see content/skqs-shanhaijing/scholar-map.yaml for example)`)
  console.error(`or pass --map <path.yaml> explicitly.`)
  process.exit(1)
}

function main(): void {
  const args = process.argv.slice(2)
  if (args.length < 1) {
    console.error('Usage: split-commentary-layers <piece-dir> [--map <map.yaml>] [--dry-run] [--clean-text] [--keep-original]')
    process.exit(1)
  }

  const pieceDir = resolve(args[0])
  const mapIdx = args.indexOf('--map')
  const dryRun = args.includes('--dry-run')
  const keepOriginal = args.includes('--keep-original')
  const cleanText = args.includes('--clean-text')

  const mapPath = findScholarMap(pieceDir, mapIdx !== -1 ? args[mapIdx + 1] : undefined)
  const map = loadScholarMap(mapPath)

  const textPath = join(pieceDir, 'text.cham.md')
  const commentaryPath = join(pieceDir, 'commentary.cham.md')

  if (!existsSync(textPath)) { console.error(`Missing: ${textPath}`); process.exit(1) }
  if (!existsSync(commentaryPath)) { console.error(`Missing: ${commentaryPath}`); process.exit(1) }

  const primaryDoc = parse(readFileSync(textPath, 'utf-8'))
  const commentaryDoc = parse(readFileSync(commentaryPath, 'utf-8'))

  const result = splitCommentaryByScholar(commentaryDoc, primaryDoc, map, { dryRun, keepOriginal })

  console.log(`\n${basename(pieceDir)}:`)
  console.log(`  (map: ${mapPath})`)
  for (const [key, count] of Object.entries(result.counts)) {
    const scholar = map.scholars[key] || Object.values(map.scholars).find(s => s.file === map.default)
    const file = scholar?.file ?? '?'
    console.log(`  ${key}: ${count} annotations → ${file}.cham.md`)
  }
  if (result.unmatched.length > 0) {
    console.log(`  UNMATCHED: ${result.unmatched.length} annotations`)
    if (!map.default) {
      console.log(`  Add a "default:" key to scholar-map.yaml to route these automatically.`)
    }
  }

  if (cleanText) {
    const cleanedText = cleanPrimaryTextMarkers(primaryDoc)
    console.log(`  primary text: ${primaryDoc.markers.size} markers will be stripped`)
    if (!dryRun) {
      writeFileSync(textPath, cleanedText, 'utf-8')
      console.log(`  wrote cleaned text.cham.md`)
    }
  }

  if (dryRun) {
    console.log('\n(dry run — no files written)')
    return
  }

  for (const [file, content] of Object.entries(result.outputs)) {
    const outPath = join(pieceDir, `${file}.cham.md`)
    writeFileSync(outPath, content, 'utf-8')
    console.log(`  wrote ${file}.cham.md`)
  }

  if (!keepOriginal) {
    console.log(`\n  NOTE: original commentary.cham.md kept. Remove manually after verifying:`)
    console.log(`    rm ${commentaryPath}`)
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}

export { main as splitCommentaryLayersCli }

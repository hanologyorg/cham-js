import { readFileSync, readdirSync, existsSync } from 'fs'
import { join, basename } from 'path'
import { parse } from './parser.js'
import { parseYaml } from './yaml.js'
import type {
  ChamDocument, ValidationIssue, ValidationResult,
  BookConfig, BookLayer,
} from './types.js'

const KNOWN_KINDS = new Set([
  'pron', 'meaning', 'person', 'place', 'event',
  'date', 'allusion', 'commentary', 'translation',
  'collation', 'fanqie', 'variant',
])

export class ChamValidator {
  private issues: ValidationIssue[] = []

  validateBook(bookDir: string): ValidationResult {
    this.issues = []

    const bookYaml = this.loadBookYaml(bookDir)
    if (!bookYaml) {
      return { valid: false, issues: this.issues }
    }

    const config = bookYaml
    const pieceDirs = this.scanPieceDirs(bookDir)

    if (pieceDirs.length === 0) {
      this.error(bookDir, undefined, 'No piece directories with text.cham.md found')
      return { valid: false, issues: this.issues }
    }

    const allPrimaryDocs = new Map<string, ChamDocument>()

    for (const dir of pieceDirs) {
      const dirName = basename(dir)
      const primaryDoc = this.validatePrimaryFile(dir)
      if (primaryDoc) {
        allPrimaryDocs.set(dirName, primaryDoc)
        this.validateMarkerIntegrity(primaryDoc, dirName)
        this.validateAnnotationRefs(primaryDoc, dirName)
      }

      this.validateSecondaryFiles(dir, dirName, allPrimaryDocs)
    }

    this.validateBookConfig(config, pieceDirs)

    return {
      valid: !this.issues.some(i => i.severity === 'error'),
      issues: this.issues,
    }
  }

  validateFile(filePath: string): ValidationResult {
    this.issues = []
    const src = readFileSync(filePath, 'utf-8')

    try {
      const doc = parse(src)
      const fileName = basename(filePath)

      if (doc.meta.type === 'primary') {
        this.validateMarkerIntegrity(doc, fileName)
        this.validateAnnotationRefs(doc, fileName)
      }

      for (const section of doc.sections) {
        for (const entry of section.entries) {
          if (!KNOWN_KINDS.has(entry.kind) && !entry.kind.includes(':')) {
            this.warning(filePath, undefined, `Unknown annotation kind: "${entry.kind}"`)
          }
          if (!entry.value && entry.kind !== 'variant') {
            this.warning(filePath, undefined, `Empty annotation value for marker ${JSON.stringify(entry.target)}`)
          }
        }
      }
    } catch (e) {
      this.error(filePath, undefined, `Parse error: ${(e as Error).message}`)
    }

    return {
      valid: !this.issues.some(i => i.severity === 'error'),
      issues: this.issues,
    }
  }

  // ─── Primary File ──────────────────────────────────────────

  private validatePrimaryFile(pieceDir: string): ChamDocument | null {
    const chamPath = join(pieceDir, 'text.cham.md')
    if (!existsSync(chamPath)) {
      this.error(pieceDir, undefined, 'Missing text.cham.md')
      return null
    }

    const src = readFileSync(chamPath, 'utf-8')
    try {
      const doc = parse(src)
      if (doc.meta.type !== 'primary') {
        this.error(chamPath, undefined, 'Expected primary frontmatter type')
        return null
      }
      return doc
    } catch (e) {
      this.error(chamPath, undefined, `Parse error: ${(e as Error).message}`)
      return null
    }
  }

  // ─── Secondary Files ──────────────────────────────────────

  private validateSecondaryFiles(
    pieceDir: string,
    dirName: string,
    primaryDocs: Map<string, ChamDocument>,
  ): void {
    const files = readdirSync(pieceDir)
    const primaryDoc = primaryDocs.get(dirName)

    for (const f of files) {
      if (!f.endsWith('.cham.md') || f === 'text.cham.md') continue
      const filePath = join(pieceDir, f)
      const src = readFileSync(filePath, 'utf-8')

      try {
        const doc = parse(src)
        if (doc.meta.type !== 'secondary') {
          this.warning(filePath, undefined, 'Expected secondary frontmatter type')
          continue
        }

        if (doc.meta.base !== 'text.cham.md') {
          this.warning(filePath, undefined, `Unexpected base reference: "${doc.meta.base}"`)
        }

        if (primaryDoc) {
          this.validateLayerAnnotations(doc, primaryDoc, filePath, f)
        }
      } catch (e) {
        this.error(filePath, undefined, `Parse error: ${(e as Error).message}`)
      }
    }
  }

  // ─── Marker Integrity ─────────────────────────────────────

  private validateMarkerIntegrity(doc: ChamDocument, context: string): void {
    const textSource = doc.textBlocks.map(b => b.source).join('\n\n')
    const openMarkers = new Set<number>()
    const closeMarkers = new Set<number>()

    for (const m of doc.markers.values()) {
      openMarkers.add(m.id)
      closeMarkers.add(m.id)
    }

    // Check for unclosed markers in source
    const opens = [...textSource.matchAll(/\{(\d+)\}/g)].map(m => parseInt(m[1]))
    const closes = [...textSource.matchAll(/\{\/(\d+)\}/g)].map(m => parseInt(m[1]))

    for (const id of opens) {
      if (!closes.includes(id)) {
        this.error(context, undefined, `Unclosed marker {${id}}`)
      }
    }
    for (const id of closes) {
      if (!opens.includes(id)) {
        this.error(context, undefined, `Orphan close marker {/${id}}`)
      }
    }

    // Check marker text matches
    for (const [id, marker] of doc.markers) {
      if (marker.length > 0 && marker.text) {
        const block = doc.textBlocks[marker.blockIndex]
        if (block) {
          const actual = block.text.slice(marker.offset, marker.offset + marker.length)
          if (actual !== marker.text) {
            this.warning(context, undefined,
              `Marker ${id} text mismatch: expected "${marker.text}", got "${actual}"`)
          }
        }
      }
    }
  }

  // ─── Annotation Reference Validation ──────────────────────

  private validateAnnotationRefs(doc: ChamDocument, context: string): void {
    for (const section of doc.sections) {
      for (const entry of section.entries) {
        if (entry.target.type === 'marker') {
          if (!doc.markers.has(entry.target.markerId)) {
            this.error(context, undefined,
              `Annotation references missing marker {${entry.target.markerId}}`)
          }
        }

        if (!KNOWN_KINDS.has(entry.kind) && !entry.kind.includes(':')) {
          this.warning(context, undefined, `Unknown annotation kind: "${entry.kind}"`)
        }
      }
    }

    // Check for markers without annotations
    const annotatedMarkers = new Set<number>()
    for (const section of doc.sections) {
      for (const entry of section.entries) {
        if (entry.target.type === 'marker') {
          annotatedMarkers.add(entry.target.markerId)
        }
      }
    }

    for (const [id] of doc.markers) {
      if (!annotatedMarkers.has(id)) {
        this.warning(context, undefined, `Marker {${id}} has no annotation entry`)
      }
    }
  }

  // ─── Layer Annotation Validation ──────────────────────────

  private validateLayerAnnotations(
    layerDoc: ChamDocument,
    primaryDoc: ChamDocument,
    filePath: string,
    fileName: string,
  ): void {
    for (const section of layerDoc.sections) {
      for (const entry of section.entries) {
        if (entry.target.type === 'marker') {
          if (!primaryDoc.markers.has(entry.target.markerId)) {
            this.error(filePath, undefined,
              `Layer ${fileName} references marker {${entry.target.markerId}} not in primary text`)
          }
        }
      }
    }
  }

  // ─── Book Config Validation ───────────────────────────────

  private validateBookConfig(config: BookConfig, pieceDirs: string[]): void {
    if (!config.id) this.warning('book.yaml', undefined, 'Missing book id')
    if (!config.title) this.warning('book.yaml', undefined, 'Missing book title')
    if (!config.genre) this.info('book.yaml', undefined, 'No genre specified')

    if (config.layers) {
      for (const layer of config.layers) {
        if (!layer.id) this.error('book.yaml', undefined, 'Layer missing id')
        if (!layer.label) this.warning('book.yaml', undefined, `Layer "${layer.id}" missing label`)
        if (!layer.contributor) this.warning('book.yaml', undefined, `Layer "${layer.id}" missing contributor`)
      }
    }

    if (config.volumes) {
      const volumePieces: string[] = []
      for (const vol of config.volumes) {
        if (!vol.label) this.warning('book.yaml', undefined, 'Volume missing label')
        volumePieces.push(...vol.pieces)
      }

      const dirNames = pieceDirs.map(d => basename(d))
      for (const p of volumePieces) {
        if (!dirNames.includes(p)) {
          this.warning('book.yaml', undefined, `Volume references missing piece dir: "${p}"`)
        }
      }
    }

    if (config.contributors) {
      for (const c of config.contributors) {
        if (!c.ref) this.error('book.yaml', undefined, 'Contributor missing ref')
        if (!c.role) this.warning('book.yaml', undefined, `Contributor "${c.ref}" missing role`)
      }
    }
  }

  // ─── Helpers ──────────────────────────────────────────────

  private loadBookYaml(bookDir: string): BookConfig | null {
    const path = join(bookDir, 'book.yaml')
    if (!existsSync(path)) {
      this.error(bookDir, undefined, 'Missing book.yaml')
      return null
    }

    const src = readFileSync(path, 'utf-8')
    try {
      return parseYaml(src) as unknown as BookConfig
    } catch (e) {
      this.error(path, undefined, `Invalid YAML: ${(e as Error).message}`)
      return null
    }
  }

  private scanPieceDirs(bookDir: string): string[] {
    const dirs: string[] = []
    for (const entry of readdirSync(bookDir).sort()) {
      const dir = join(bookDir, entry)
      if (existsSync(join(dir, 'text.cham.md'))) {
        dirs.push(dir)
      }
    }
    return dirs
  }

  private error(file: string | undefined, line: number | undefined, message: string): void {
    this.issues.push({ severity: 'error', file, line, message })
  }

  private warning(file: string | undefined, line: number | undefined, message: string): void {
    this.issues.push({ severity: 'warning', file, line, message })
  }

  private info(file: string | undefined, line: number | undefined, message: string): void {
    this.issues.push({ severity: 'info', file, line, message })
  }
}

import { readFileSync, readdirSync, existsSync } from 'fs'
import { join, basename } from 'path'
import { parse } from './parser.js'
import { parseYaml } from './yaml.js'
import { RegistryLoader } from './registry.js'
import type {
  ChamDocument, ValidationIssue, ValidationResult,
  BookConfig, BookLayer, ChamRegistries,
} from './types.js'

const KIND_PARAMS: Record<string, { required: string[]; optional: string[] }> = {
  pron: { required: ['type', 'lang'], optional: [] },
  meaning: { required: [], optional: [] },
  person: { required: [], optional: ['ref'] },
  place: { required: [], optional: ['ref'] },
  event: { required: [], optional: ['ref'] },
  date: { required: [], optional: ['dynasty', 'era', 'year', 'iso'] },
  allusion: { required: [], optional: ['source'] },
  commentary: { required: [], optional: [] },
  translation: { required: [], optional: [] },
  collation: { required: [], optional: ['source'] },
  variant: { required: [], optional: ['action'] },
  'see-also': { required: [], optional: ['ref'] },
}

const KNOWN_KINDS = new Set(Object.keys(KIND_PARAMS))

export class ChamValidator {
  private issues: ValidationIssue[] = []
  private lastParsedDocs: Array<{ filePath: string; doc: ChamDocument }> = []

  validateBook(bookDir: string): ValidationResult {
    this.issues = []
    this.lastParsedDocs = []

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

  validateBookWithRegistries(bookDir: string, dataDir: string): ValidationResult {
    const result = this.validateBook(bookDir)
    if (!result.valid) return result

    const registries = new RegistryLoader().loadAll(dataDir)
    this.validateRegistryRefs(this.lastParsedDocs, registries)

    result.valid = !this.issues.some(i => i.severity === 'error')
    result.issues = this.issues
    return result
  }

  validateFile(filePath: string): ValidationResult {
    this.issues = []
    const src = readFileSync(filePath, 'utf-8')

    try {
      const doc = parse(src)
      const fileName = basename(filePath)

      this.validateFrontmatter(doc, filePath)

      if (doc.meta.type === 'primary') {
        this.validateMarkerInterleaving(doc, fileName)
        this.validateMarkerIntegrity(doc, fileName)
        this.validateAnnotationRefs(doc, fileName)
      }

      this.validateKindParams(doc, filePath)
      this.validateBracketBalance(doc, filePath)

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

  private validateFrontmatter(doc: ChamDocument, filePath: string): void {
    if (doc.meta.type === 'primary') {
      const pm = doc.meta as import('./types.js').PrimaryMeta
      if (pm.id === undefined || pm.id === '') {
        this.error(filePath, undefined, 'Primary file missing required field: id')
      }
      if (!pm.title) {
        this.error(filePath, undefined, 'Primary file missing required field: title')
      }
    } else if (doc.meta.type === 'secondary') {
      const sm = doc.meta as import('./types.js').SecondaryMeta
      if (!sm.base) {
        this.error(filePath, undefined, 'Secondary file missing required field: base')
      }
      if (!sm.contributor) {
        this.warning(filePath, undefined, 'Secondary file missing recommended field: contributor')
      }
      if (!sm.role) {
        this.warning(filePath, undefined, 'Secondary file missing recommended field: role')
      }
    }
  }

  // ─── Marker Interleaving ─────────────────────────────────────

  private validateMarkerInterleaving(doc: ChamDocument, context: string): void {
    const textSource = doc.textBlocks.map(b => b.source).join('\n\n')

    interface MarkerEvent { id: number; offset: number; type: 'open' | 'close' }
    const events: MarkerEvent[] = []

    for (const m of [...textSource.matchAll(/\{\/?(\d+)\}/g)]) {
      const isClose = m[0].includes('/')
      events.push({ id: parseInt(m[1], 10), offset: m.index!, type: isClose ? 'close' : 'open' })
    }

    events.sort((a, b) => a.offset - b.offset)

    const stack: number[] = []
    for (const ev of events) {
      if (ev.type === 'open') {
        stack.push(ev.id)
      } else {
        if (stack.length === 0) {
          this.error(context, undefined, `Orphan close marker {/${ev.id}}`)
        } else if (stack[stack.length - 1] !== ev.id) {
          this.error(context, undefined,
            `Interleaved markers: {${stack[stack.length - 1]}} not closed before {/${ev.id}}`)
        } else {
          stack.pop()
        }
      }
    }

    for (const id of stack) {
      this.error(context, undefined, `Unclosed marker {${id}}`)
    }
  }

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
      this.validateFrontmatter(doc, chamPath)
      this.validateMarkerInterleaving(doc, chamPath)
      this.lastParsedDocs.push({ filePath: chamPath, doc })
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
    const primarySectionNames = new Set(
      primaryDoc?.sections.map(s => s.name) || [],
    )

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

        if (doc.textBlocks.length > 0) {
          this.error(filePath, undefined, 'Subordinate file must not contain text content')
        }
        if (doc.markers.size > 0) {
          this.error(filePath, undefined, 'Subordinate file must not contain inline markers')
        }

        this.lastParsedDocs.push({ filePath, doc })

        if (doc.meta.base !== 'text.cham.md') {
          this.warning(filePath, undefined, `Unexpected base reference: "${doc.meta.base}"`)
        }

        for (const section of doc.sections) {
          if (primarySectionNames.has(section.name)) {
            this.error(filePath, undefined,
              `Duplicate section name "${section.name}" — already defined in primary file`)
          }
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

  // ─── Kind-Specific Param Validation ────────────────────────

  private validateKindParams(doc: ChamDocument, filePath: string): void {
    for (const section of doc.sections) {
      for (const entry of section.entries) {
        const schema = KIND_PARAMS[entry.kind]
        if (!schema) continue
        for (const req of schema.required) {
          if (!(req in entry.params)) {
            this.error(filePath, undefined,
              `Annotation kind "${entry.kind}" missing required param: ${req}`)
          }
        }
      }
    }
  }

  // ─── Bracket Balance ────────────────────────────────────────

  private validateBracketBalance(doc: ChamDocument, filePath: string): void {
    for (const section of doc.sections) {
      for (const entry of section.entries) {
        let depth = 0
        for (const ch of entry.value) {
          if (ch === '[') depth++
          else if (ch === ']') depth--
          if (depth < 0) {
            this.warning(filePath, undefined, `Unbalanced brackets in annotation value for ${JSON.stringify(entry.target)}`)
            break
          }
        }
        if (depth > 0) {
          this.warning(filePath, undefined, `Unbalanced brackets in annotation value for ${JSON.stringify(entry.target)}`)
        }
      }
    }
  }

  // ─── Registry Ref Validation ────────────────────────────────

  private validateRegistryRefs(
    docs: Array<{ filePath: string; doc: ChamDocument }>,
    registries: ChamRegistries,
  ): void {
    for (const { filePath, doc } of docs) {
      for (const section of doc.sections) {
        for (const entry of section.entries) {
          const ref = entry.params.ref
          if (!ref) continue
          if (entry.kind === 'person' && registries.authors && !(ref in registries.authors)) {
            this.warning(filePath, undefined, `Author ref "${ref}" not found in authors registry`)
          }
          if (entry.kind === 'place' && registries.places && !(ref in registries.places)) {
            this.warning(filePath, undefined, `Place ref "${ref}" not found in places registry`)
          }
          if (entry.kind === 'event' && registries.events && !(ref in registries.events)) {
            this.warning(filePath, undefined, `Event ref "${ref}" not found in events registry`)
          }
        }
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

// ─── CHAM Validator (Orchestrator) ─────────────────────────────
// Runs all registered validation rules against a CHAM document,
// piece directory, or entire book. Returns a ValidationResult.
//
// This is a thin orchestrator: all checking logic lives in the
// individual rule classes under validation/rules/. Adding a new
// check = adding a new rule class + registering it.

import { readFileSync, readdirSync, existsSync } from 'fs'
import { join, basename } from 'path'
import { parse } from '../parser.js'
import { parseBookConfig } from '../book-config-loader.js'
import { RegistryLoader } from '../registry.js'
import { TargetResolver } from '../resolver.js'
import { AnnotationKindRegistry } from '../model.js'
import { loadYaml } from '../yaml.js'
import type {
  ChamDocument, ValidationIssue, ValidationResult,
  BookConfig, ChamRegistries, PrimaryMeta,
} from '../types.js'
import type { ValidationContext, ValidationRule } from './validation-rule.js'
import { RuleRegistry } from './rule-registry.js'

/**
 * CHAM validator. Runs a set of validation rules against documents.
 *
 * Construction:
 *   const v = new ChamValidator()                          // all defaults
 *   const v = new ChamValidator(ruleRegistry)              // custom rule set (legacy)
 *   const v = new ChamValidator({ rules: customRules })    // custom rule set
 *   const v = new ChamValidator({ kindRegistry: custom })  // custom kinds
 *
 * Usage:
 *   v.validateFile('path/to/text.cham.md')
 *   v.validateBook('path/to/book-dir')
 *   v.validateBookWithRegistries('path/to/book-dir', 'path/to/data-dir')
 */
export interface ChamValidatorOptions {
  /** Rule registry. Defaults to the standard set of built-in rules. */
  readonly rules?: RuleRegistry
  /** Annotation kind registry. Defaults to built-in kinds. */
  readonly kindRegistry?: AnnotationKindRegistry
}

export class ChamValidator {
  private readonly registry: RuleRegistry
  private readonly kindRegistry: AnnotationKindRegistry

  constructor(
    registryOrOptions: RuleRegistry | ChamValidatorOptions = RuleRegistry.DEFAULT,
  ) {
    if (registryOrOptions instanceof RuleRegistry) {
      this.registry = registryOrOptions
      this.kindRegistry = AnnotationKindRegistry.DEFAULT
    } else {
      this.registry = registryOrOptions.rules ?? RuleRegistry.DEFAULT
      this.kindRegistry = registryOrOptions.kindRegistry ?? AnnotationKindRegistry.DEFAULT
    }
  }

  // ─── Single-File Validation ──────────────────────────────────

  /**
   * Validates a single .cham.md file.
   * Runs all rules that can operate on a single document (no book context).
   *
   * Pass `registries` to enable registry-aware rules (author/place/event
   * ref checks, date consistency against era registry, etc.). Without it,
   * registry-category rules run but find no registries on the context and
   * effectively skip.
   */
  validateFile(filePath: string, registries?: ChamRegistries): ValidationResult {
    const issues: ValidationIssue[] = []
    const src = readFileSync(filePath, 'utf-8')

    let doc: ChamDocument | undefined
    try {
      doc = parse(src)
    } catch (e) {
      return {
        valid: false,
        issues: [{
          severity: 'error', file: filePath,
          message: `Parse error: ${(e as Error).message}`,
        }],
      }
    }

    const resolver = doc.textBlocks.length > 0
      ? new TargetResolver(doc.markers, doc.textBlocks)
      : undefined

    for (const rule of this.registry.all()) {
      const ctx: ValidationContext = { doc, filePath, resolver, kindRegistry: this.kindRegistry, registries }
      issues.push(...rule.check(ctx))
    }
    return { valid: !issues.some(i => i.severity === 'error'), issues }
  }

  // ─── Book Validation ─────────────────────────────────────────

  /**
   * Validates an entire book directory (all pieces + book.yaml).
   *
   * Pass `registries` to enable registry-aware rules in the same pass —
   * no second traversal needed. Without it, registry-category rules
   * effectively skip.
   */
  validateBook(bookDir: string, registries?: ChamRegistries): ValidationResult {
    const issues: ValidationIssue[] = []
    const config = this.loadBookYaml(bookDir, issues)
    if (!config) return { valid: false, issues }

    const pieceDirs = this.scanPieceDirs(bookDir)
    if (pieceDirs.length === 0) {
      issues.push({ severity: 'error', file: bookDir, message: 'No piece directories with text.cham.md found' })
      return { valid: false, issues }
    }

    // Validate book.yaml config
    const bookConfigCtx: ValidationContext = {
      doc: { meta: { type: 'primary', id: '', title: '' } } as ChamDocument,
      filePath: join(bookDir, 'book.yaml'),
      bookConfig: config,
      registries,
    }
    for (const rule of this.registry.byCategory('config')) {
      issues.push(...rule.check(bookConfigCtx))
    }

    for (const dir of pieceDirs) {
      this.validatePieceDir(dir, config, issues, registries)
    }

    return { valid: !issues.some(i => i.severity === 'error'), issues }
  }

  /**
   * Validates an entire book with registries loaded from `dataDir`.
   * Equivalent to `validateBook(bookDir, new RegistryLoader().loadAll(dataDir))`.
   */
  validateBookWithRegistries(bookDir: string, dataDir: string): ValidationResult {
    return this.validateBook(bookDir, new RegistryLoader().loadAll(dataDir))
  }

  // ─── Internal Helpers ────────────────────────────────────────

  private validatePieceDir(
    pieceDir: string,
    config: BookConfig,
    issues: ValidationIssue[],
    registries?: ChamRegistries,
  ): void {
    const textPath = join(pieceDir, 'text.cham.md')
    if (!existsSync(textPath)) {
      issues.push({ severity: 'error', file: pieceDir, message: 'Missing text.cham.md' })
      return
    }

    let primaryDoc: ChamDocument | undefined
    try {
      primaryDoc = parse(readFileSync(textPath, 'utf-8'))
      if (primaryDoc.meta.type !== 'primary') {
        issues.push({ severity: 'error', file: textPath, message: 'Expected primary frontmatter type' })
        return
      }
    } catch (e) {
      issues.push({ severity: 'error', file: textPath, message: `Parse error: ${(e as Error).message}` })
      return
    }

    // ─── Pass 1: Parse all secondary files ────────────────────
    // Collect them for cross-file context (e.g., marker-annotated needs to
    // know which markers are referenced in commentary files).
    const secondaryDocs: Array<{ doc: ChamDocument; filePath: string }> = []
    for (const f of readdirSync(pieceDir).sort()) {
      if (!f.endsWith('.cham.md') || f === 'text.cham.md') continue
      const filePath = join(pieceDir, f)
      let layerDoc: ChamDocument | undefined
      try {
        layerDoc = parse(readFileSync(filePath, 'utf-8'))
      } catch (e) {
        issues.push({ severity: 'error', file: filePath, message: `Parse error: ${(e as Error).message}` })
        continue
      }
      if (layerDoc.meta.type !== 'secondary') continue

      // Secondary files must not contain text content or inline markers
      if (layerDoc.textBlocks.length > 0) {
        issues.push({ severity: 'error', file: filePath, message: 'Subordinate file must not contain text content' })
      }
      if (layerDoc.markers.size > 0) {
        issues.push({ severity: 'error', file: filePath, message: 'Subordinate file must not contain inline markers' })
      }

      secondaryDocs.push({ doc: layerDoc, filePath })
    }

    // ─── Collect cross-file context: secondary marker refs ────
    const secondaryMarkerRefs = new Set<number>()
    for (const { doc } of secondaryDocs) {
      for (const section of doc.sections) {
        for (const entry of section.entries) {
          if (entry.target.type === 'marker') {
            secondaryMarkerRefs.add(entry.target.markerId)
          }
        }
      }
    }

    // ─── Run rules ───────────────────────────────────────────
    // Single pass: all categories run with the same parsed docs.
    // Registry-category rules see `registries` when provided.
    const primaryResolver = new TargetResolver(primaryDoc.markers, primaryDoc.textBlocks)

    // Validate primary document
    for (const rule of this.registry.all()) {
      if (rule.category === 'config') continue // already ran at book level
      const ctx: ValidationContext = {
        doc: primaryDoc, filePath: textPath,
        bookConfig: config, resolver: primaryResolver,
        secondaryMarkerRefs, kindRegistry: this.kindRegistry, registries,
      }
      issues.push(...rule.check(ctx))
    }

    // Validate secondary (layer) files
    for (const { doc: layerDoc, filePath } of secondaryDocs) {
      const layerResolver = primaryResolver // secondary resolves against primary
      for (const rule of this.registry.all()) {
        if (rule.category === 'config') continue
        // Skip marker-structural rules on secondary (they have no markers).
        // target-resolution still applies (it checks marker refs against primary).
        if (rule.category === 'marker' && rule.id !== 'target-resolution') continue
        const ctx: ValidationContext = {
          doc: layerDoc, filePath,
          primaryDoc, bookConfig: config, resolver: layerResolver,
          kindRegistry: this.kindRegistry, registries,
        }
        issues.push(...rule.check(ctx))
      }
    }
  }

  private loadBookYaml(bookDir: string, issues: ValidationIssue[]): BookConfig | null {
    const path = join(bookDir, 'book.yaml')
    if (!existsSync(path)) {
      issues.push({ severity: 'error', file: bookDir, message: 'Missing book.yaml' })
      return null
    }
    try {
      const raw = loadYaml(path) as Record<string, unknown>
      return parseBookConfig(raw, basename(bookDir))
    } catch (e) {
      issues.push({ severity: 'error', file: path, message: `Invalid YAML: ${(e as Error).message}` })
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

  /** Exposes the rule registry for introspection or runtime modification. */
  get rules(): RuleRegistry {
    return this.registry
  }
}

/** Convenience function: validate a single CHAM file. */
export function validateFile(filePath: string): ValidationResult {
  return new ChamValidator().validateFile(filePath)
}

/** Convenience function: validate an entire book. */
export function validateBook(bookDir: string): ValidationResult {
  return new ChamValidator().validateBook(bookDir)
}

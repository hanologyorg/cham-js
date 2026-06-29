// ─── Validation Rule Interface ─────────────────────────────────
// Defines the contract for all validation rules. Each rule is a class
// that examines a ValidationContext and reports issues.
//
// Open/Closed: new rules are ADDED (new file + register), not EDITED
// (no modification to existing rules or the orchestrator).

import type {
  ChamDocument, ValidationIssue,
  BookConfig, ChamRegistries,
} from '../types.js'
import type { TargetResolver } from '../resolver/target-resolver.js'
import type { AnnotationKindRegistry } from '../model/annotation-kind.js'

/**
 * Context passed to every validation rule.
 *
 * Contains the document under inspection, plus any related documents
 * and configuration needed for cross-reference checks.
 *
 * Fields are optional because rules vary in what they need:
 * - `primaryDoc` is set only when validating a secondary file
 * - `bookConfig` is set when validating a piece within a book
 * - `registries` is set when running registry-aware validation
 * - `resolver` is set when target resolution is available
 * - `secondaryMarkerRefs` is set for primary docs and contains the union
 *   of all marker IDs referenced by any secondary file in the same piece
 */
export interface ValidationContext {
  /** The document under inspection. */
  readonly doc: ChamDocument
  /** File path or directory name for issue reporting. */
  readonly filePath: string
  /** The primary document, when `doc` is a secondary layer file. */
  readonly primaryDoc?: ChamDocument
  /** The book config, when validating within a book. */
  readonly bookConfig?: BookConfig
  /** Loaded registries, when running with `--registry`. */
  readonly registries?: ChamRegistries
  /** Resolver for target validation (built from primaryDoc or doc). */
  readonly resolver?: TargetResolver
  /** Marker IDs referenced by any secondary file in this piece (primary only). */
  readonly secondaryMarkerRefs?: ReadonlySet<number>
  /**
   * Annotation kind registry. Defaults to `AnnotationKindRegistry.DEFAULT`.
   * Use a custom registry to support project-specific annotation kinds.
   */
  readonly kindRegistry?: AnnotationKindRegistry
}

/**
 * Category for grouping rules in the registry.
 * Useful for selective rule execution (e.g., skip registry rules when offline).
 */
export type RuleCategory =
  | 'frontmatter'    // required fields, meta type discrimination
  | 'marker'         // interleaving, uniqueness, integrity, annotation coverage
  | 'target'         // marker refs, verse bounds, text-quote resolution
  | 'kind'           // required params, value format, known kinds
  | 'structure'      // bracket balance, text sections
  | 'quality'        // compound annotations, pinyin IPA, empty values
  | 'registry'       // author/place/event/dynasty refs
  | 'config'         // book.yaml validation

/**
 * The validation rule contract.
 *
 * Implementations examine `ctx` and return a list of issues (empty if clean).
 * Rules must be pure: no side effects, no I/O, deterministic.
 *
 * Each rule has a stable `id` for logging, disabling, and dependency tracking.
 */
export interface ValidationRule {
  /** Stable unique identifier for this rule. */
  readonly id: string
  /** Category for grouping and selective execution. */
  readonly category: RuleCategory
  /** Human-readable description of what this rule checks. */
  readonly description: string
  /** Returns issues found in the context. Empty array = no issues. */
  check(ctx: ValidationContext): readonly ValidationIssue[]
}

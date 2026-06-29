// ─── Validation Rule Registry ──────────────────────────────────
// Stores validation rules indexed by ID. Rules can be registered,
// unregistered, and queried by ID or category.
//
// Open/Closed: add new rules via `register()` without modifying
// existing rule classes or the validator orchestrator.

import type { ValidationRule, RuleCategory } from './validation-rule.js'

/**
 * Immutable-after-construction registry of validation rules.
 *
 * The DEFAULT instance contains all built-in rules. Custom rules
 * can be added by constructing a new registry with additional entries,
 * or by calling `register()` on a mutable clone.
 */
export class RuleRegistry {
  private readonly rules = new Map<string, ValidationRule>()

  constructor(initial: readonly ValidationRule[] = []) {
    for (const rule of initial) {
      this.register(rule)
    }
  }

  /**
   * The standard registry with all built-in validation rules.
   * Populated lazily to avoid import cycles.
   */
  static get DEFAULT(): RuleRegistry {
    if (!defaultRegistry) {
      defaultRegistry = new RuleRegistry(BUILTIN_RULES)
    }
    return defaultRegistry
  }

  /** Register a new rule. Throws if a rule with the same ID exists. */
  register(rule: ValidationRule): void {
    if (this.rules.has(rule.id)) {
      throw new Error(`Validation rule "${rule.id}" is already registered`)
    }
    this.rules.set(rule.id, rule)
  }

  /** Unregister a rule by ID. Returns true if removed. */
  unregister(id: string): boolean {
    return this.rules.delete(id)
  }

  /** Get a rule by ID. */
  get(id: string): ValidationRule | undefined {
    return this.rules.get(id)
  }

  /** Whether a rule with the given ID is registered. */
  has(id: string): boolean {
    return this.rules.has(id)
  }

  /** All registered rules, in insertion order. */
  all(): readonly ValidationRule[] {
    return [...this.rules.values()]
  }

  /** All registered rules matching the given category. */
  byCategory(category: RuleCategory): readonly ValidationRule[] {
    return [...this.rules.values()].filter(r => r.category === category)
  }

  /** Returns a mutable clone of this registry. */
  clone(): RuleRegistry {
    return new RuleRegistry(this.all())
  }
}

let defaultRegistry: RuleRegistry | undefined

// ─── Built-in Rules ────────────────────────────────────────────
// Importing here (rather than at top) avoids circular dependencies
// when rule modules import from the registry for self-identification.

import { FrontmatterRequiredRule } from './rules/frontmatter-rule.js'
import { MarkerInterleavingRule } from './rules/marker-interleaving-rule.js'
import { MarkerUniquenessRule } from './rules/marker-uniqueness-rule.js'
import { MarkerIntegrityRule } from './rules/marker-integrity-rule.js'
import { MarkerSequentialRule } from './rules/marker-sequential-rule.js'
import { MarkerAnnotatedRule } from './rules/marker-annotated-rule.js'
import { TargetResolutionRule } from './rules/target-resolution-rule.js'
import { VerseBoundsRule } from './rules/verse-bounds-rule.js'
import { KindParamsRule } from './rules/kind-params-rule.js'
import { KindValuesRule } from './rules/kind-values-rule.js'
import { KnownKindRule } from './rules/known-kind-rule.js'
import { CompoundAnnotationRule } from './rules/compound-annotation-rule.js'
import { BracketBalanceRule } from './rules/bracket-balance-rule.js'
import { NestedBracketsRule } from './rules/nested-brackets-rule.js'
import { PinyinIpaRule } from './rules/pinyin-ipa-rule.js'
import { AnnotationQualityRule } from './rules/annotation-quality-rule.js'
import { SpeakerRule } from './rules/speaker-rule.js'
import { DateConsistencyRule } from './rules/date-rule.js'
import { NatureValidRule } from './rules/nature-rule.js'
import { TextSectionRule } from './rules/text-section-rule.js'
import { RegistryRefsRule } from './rules/registry-refs-rule.js'
import { DynastyRefsRule } from './rules/dynasty-refs-rule.js'
import { BookConfigRule } from './rules/book-config-rule.js'
import { HierarchyRule } from './rules/hierarchy-rule.js'
import { DuplicateSectionRule } from './rules/duplicate-section-rule.js'

const BUILTIN_RULES: readonly ValidationRule[] = [
  new FrontmatterRequiredRule(),
  new MarkerInterleavingRule(),
  new MarkerUniquenessRule(),
  new MarkerIntegrityRule(),
  new MarkerSequentialRule(),
  new MarkerAnnotatedRule(),
  new TargetResolutionRule(),
  new VerseBoundsRule(),
  new KindParamsRule(),
  new KindValuesRule(),
  new KnownKindRule(),
  new CompoundAnnotationRule(),
  new BracketBalanceRule(),
  new NestedBracketsRule(),
  new PinyinIpaRule(),
  new AnnotationQualityRule(),
  new SpeakerRule(),
  new DateConsistencyRule(),
  new NatureValidRule(),
  new TextSectionRule(),
  new RegistryRefsRule(),
  new DynastyRefsRule(),
  new BookConfigRule(),
  new HierarchyRule(),
  new DuplicateSectionRule(),
]

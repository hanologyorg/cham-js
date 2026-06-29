// ─── Validator Namespace Shim ──────────────────────────────────
// This file is the canonical entry point for the validation submodules.
// Internal and external code should import from here (or from the
// package root), not from individual files under validation/. This is
// the TypeScript equivalent of Ruby's `autoload` — definitions
// collected in the immediate parent namespace's file.
//
// Implementation lives in validation/*.ts; this shim is the public face.

// ChamValidator — the orchestrator
export { ChamValidator, validateFile, validateBook } from './validation/validator.js'

// Rule infrastructure (for custom rules)
export type { ValidationRule, ValidationContext, RuleCategory } from './validation/validation-rule.js'
export { RuleRegistry } from './validation/rule-registry.js'
export { BaseRule, isPrimary, isSecondary } from './validation/rule-helpers.js'

// Individual rule classes (for programmatic registration/unregistration)
export { FrontmatterRequiredRule } from './validation/rules/frontmatter-rule.js'
export { MarkerInterleavingRule } from './validation/rules/marker-interleaving-rule.js'
export { MarkerUniquenessRule } from './validation/rules/marker-uniqueness-rule.js'
export { MarkerIntegrityRule } from './validation/rules/marker-integrity-rule.js'
export { MarkerSequentialRule } from './validation/rules/marker-sequential-rule.js'
export { MarkerAnnotatedRule } from './validation/rules/marker-annotated-rule.js'
export { TargetResolutionRule } from './validation/rules/target-resolution-rule.js'
export { VerseBoundsRule } from './validation/rules/verse-bounds-rule.js'
export { KindParamsRule } from './validation/rules/kind-params-rule.js'
export { KindValuesRule } from './validation/rules/kind-values-rule.js'
export { KnownKindRule } from './validation/rules/known-kind-rule.js'
export { CompoundAnnotationRule } from './validation/rules/compound-annotation-rule.js'
export { BracketBalanceRule } from './validation/rules/bracket-balance-rule.js'
export { NestedBracketsRule } from './validation/rules/nested-brackets-rule.js'
export { PinyinIpaRule } from './validation/rules/pinyin-ipa-rule.js'
export { AnnotationQualityRule } from './validation/rules/annotation-quality-rule.js'
export { SpeakerRule } from './validation/rules/speaker-rule.js'
export { DateConsistencyRule } from './validation/rules/date-rule.js'
export { NatureValidRule } from './validation/rules/nature-rule.js'
export { TextSectionRule } from './validation/rules/text-section-rule.js'
export { RegistryRefsRule } from './validation/rules/registry-refs-rule.js'
export { DynastyRefsRule } from './validation/rules/dynasty-refs-rule.js'
export { BookConfigRule } from './validation/rules/book-config-rule.js'
export { HierarchyRule } from './validation/rules/hierarchy-rule.js'
export { DuplicateSectionRule } from './validation/rules/duplicate-section-rule.js'

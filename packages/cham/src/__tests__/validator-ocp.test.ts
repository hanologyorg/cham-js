import { describe, it, expect } from 'vitest'
import { ChamValidator } from '../validator.js'
import { RuleRegistry } from '../validation/rule-registry.js'
import type { ValidationRule, ValidationContext } from '../validation/validation-rule.js'
import { BaseRule } from '../validation/rule-helpers.js'
import { AnnotationKindRegistry } from '../model/annotation-kind.js'
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'fs'
import { join } from 'path'

// ─── OCP Verification: Custom Rules ────────────────────────────
// These tests prove that new validation rules can be ADDED without
// modifying existing rule classes or the validator orchestrator.

const TMP = join(import.meta.dirname, '__tmp_rule_ocp__')

function setupDir(structure: Record<string, string>): void {
  if (existsSync(TMP)) rmSync(TMP, { recursive: true })
  mkdirSync(TMP, { recursive: true })
  for (const [path, content] of Object.entries(structure)) {
    const fullPath = join(TMP, path)
    mkdirSync(join(fullPath, '..'), { recursive: true })
    writeFileSync(fullPath, content, 'utf-8')
  }
}

function cleanup(): void {
  if (existsSync(TMP)) rmSync(TMP, { recursive: true })
}

const SIMPLE_BOOK = {
  'book.yaml': 'id: t\ntitle: T',
  'p/text.cham.md': [
    '---', 'id: 1', 'title: T', '---', '', 'ABC{1}D{/1}',
  ].join('\n'),
}

describe('Rule-based validator OCP', () => {
  it('DEFAULT registry has all built-in rules', () => {
    const registry = RuleRegistry.DEFAULT
    expect(registry.all().length).toBeGreaterThanOrEqual(25)

    // Spot-check a few
    expect(registry.has('frontmatter-required')).toBe(true)
    expect(registry.has('marker-interleaving')).toBe(true)
    expect(registry.has('target-resolution')).toBe(true)
    expect(registry.has('compound-annotation')).toBe(true)
    expect(registry.has('duplicate-section')).toBe(true)
  })

  it('rules are categorized correctly', () => {
    const registry = RuleRegistry.DEFAULT
    const frontmatter = registry.byCategory('frontmatter')
    expect(frontmatter.length).toBeGreaterThanOrEqual(1)

    const markerRules = registry.byCategory('marker')
    expect(markerRules.length).toBeGreaterThanOrEqual(5) // interleaving, uniqueness, integrity, sequential, annotated

    const targetRules = registry.byCategory('target')
    expect(targetRules.length).toBeGreaterThanOrEqual(2) // resolution, verse-bounds
  })

  it('can register a custom rule without modifying existing code', () => {
    const customRule: ValidationRule = new class extends BaseRule {
      readonly id = 'custom-no-abc'
      readonly category = 'quality' as const
      readonly description = 'Forbids the letter sequence ABC'
      check(ctx: ValidationContext) {
        const issues = []
        for (const block of ctx.doc.textBlocks) {
          if (block.text.includes('ABC')) {
            issues.push(this.warning(ctx, undefined, 'Text contains forbidden "ABC"'))
          }
        }
        return issues
      }
    }()

    const registry = RuleRegistry.DEFAULT.clone()
    registry.register(customRule)

    const validator = new ChamValidator(registry)
    setupDir(SIMPLE_BOOK)
    try {
      const result = validator.validateBook(TMP)
      // The custom rule should fire because the text contains "ABC"
      expect(result.issues.some(i => i.message.includes('forbidden "ABC"'))).toBe(true)
    } finally {
      cleanup()
    }
  })

  it('can unregister a rule to disable it', () => {
    const registry = RuleRegistry.DEFAULT.clone()
    registry.unregister('marker-sequential')
    expect(registry.has('marker-sequential')).toBe(false)

    // Build a book with non-sequential markers — the rule would normally warn
    setupDir({
      'book.yaml': 'id: t\ntitle: T',
      'p/text.cham.md': [
        '---', 'id: 1', 'title: T', '---', '', 'A{1}B{/1}C{5}D{/5}',
        '', '## 注釋', '', '{1} meaning [a]', '{5} meaning [b]',
      ].join('\n'),
    })

    try {
      const validator = new ChamValidator(registry)
      const result = validator.validateBook(TMP)
      // No "Non-sequential" warnings because we unregistered the rule
      expect(result.issues.some(i => i.message.includes('Non-sequential'))).toBe(false)
    } finally {
      cleanup()
    }
  })

  it('clone produces an independent registry', () => {
    const original = RuleRegistry.DEFAULT
    const clone = original.clone()
    expect(clone.all().length).toBe(original.all().length)

    // Modifying clone doesn't affect original
    const customRule: ValidationRule = new class extends BaseRule {
      readonly id = 'test-clone'
      readonly category = 'quality' as const
      readonly description = 'Test'
      check() { return [] }
    }()

    clone.register(customRule)
    expect(clone.has('test-clone')).toBe(true)
    expect(original.has('test-clone')).toBe(false)
  })

  it('registering a duplicate rule ID throws', () => {
    const registry = new RuleRegistry()
    const rule1: ValidationRule = new class extends BaseRule {
      readonly id = 'dup'
      readonly category = 'quality' as const
      readonly description = 'Test 1'
      check() { return [] }
    }()
    const rule2: ValidationRule = new class extends BaseRule {
      readonly id = 'dup'
      readonly category = 'quality' as const
      readonly description = 'Test 2'
      check() { return [] }
    }()

    registry.register(rule1)
    expect(() => registry.register(rule2)).toThrow(/already registered/)
  })

  it('default validator produces same validation as original', () => {
    setupDir(SIMPLE_BOOK)
    try {
      const validator = new ChamValidator()
      const result = validator.validateBook(TMP)
      expect(result.valid).toBe(true) // no errors, just possibly warnings
    } finally {
      cleanup()
    }
  })
})

// ─── Custom AnnotationKindRegistry Injection ───────────────────
// Projects with domain-specific annotation kinds can construct a validator
// that recognizes them — no forking required.

describe('ChamValidator with custom AnnotationKindRegistry', () => {
  it('accepts custom kinds via options bag', () => {
    const customRegistry = new AnnotationKindRegistry([
      {
        kind: 'phonology-gloss',
        outputKind: 'phonology-gloss',
        displayOrder: 50,
        params: { required: [], optional: [] },
      },
    ])
    const validator = new ChamValidator({ kindRegistry: customRegistry })

    setupDir({
      'test.cham.md': [
        '---', 'id: 1', 'title: T', '---', '',
        '{1}A{/1}', '',
        '## Notes', '',
        '{1} phonology-gloss [custom-kind-note]',
      ].join('\n'),
    })
    try {
      const result = validator.validateFile(join(TMP, 'test.cham.md'))
      const unknownKindWarning = result.issues.find(i => i.message.includes('Unknown annotation kind'))
      expect(unknownKindWarning).toBeUndefined()
    } finally {
      cleanup()
    }
  })

  it('uses DEFAULT registry when no override given (rejects unknown kind)', () => {
    const validator = new ChamValidator()
    setupDir({
      'test.cham.md': [
        '---', 'id: 1', 'title: T', '---', '',
        '{1}A{/1}', '',
        '## Notes', '',
        '{1} phonology-gloss [custom-kind-note]',
      ].join('\n'),
    })
    try {
      const result = validator.validateFile(join(TMP, 'test.cham.md'))
      expect(result.issues.some(i => i.message.includes('Unknown annotation kind: "phonology-gloss"'))).toBe(true)
    } finally {
      cleanup()
    }
  })
})

// ─── Validator text-target integration ─────────────────────────
// The validator's text-target warning path runs TargetResolver.tryResolve
// and reports unresolved quotes. Tests TargetResolutionRule end-to-end.

describe('ChamValidator text-target integration', () => {
  it('warns on unresolvable text-quote target', () => {
    const validator = new ChamValidator()
    setupDir({
      'test.cham.md': [
        '---', 'id: 1', 'title: T', '---', '',
        '南山經之首曰招揺之山', '',
        '## Notes', '',
        '@[不存在的引文] commentary [注]',
      ].join('\n'),
    })
    try {
      const result = validator.validateFile(join(TMP, 'test.cham.md'))
      expect(result.issues.some(i => i.message.includes('Unresolvable text-quote') || i.message.includes('Text quote not found'))).toBe(true)
    } finally {
      cleanup()
    }
  })

  it('does not warn on resolvable text-quote target', () => {
    const validator = new ChamValidator()
    setupDir({
      'test.cham.md': [
        '---', 'id: 1', 'title: T', '---', '',
        '南山經之首曰招揺之山', '',
        '## Notes', '',
        '@[招揺之山] commentary [注]',
      ].join('\n'),
    })
    try {
      const result = validator.validateFile(join(TMP, 'test.cham.md'))
      const unresolved = result.issues.find(i => i.message.includes('Unresolvable') || i.message.includes('not found'))
      expect(unresolved).toBeUndefined()
    } finally {
      cleanup()
    }
  })
})

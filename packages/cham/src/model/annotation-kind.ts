// ─── Annotation Kind Taxonomy ──────────────────────────────────
// Single source of truth for all annotation kind metadata:
// - Known kinds and their specs
// - Required/optional params per kind
// - Output kind mapping (parser → pipeline)
// - Display ordering (for serializer)
//
// All consumers (validator, pipeline, serializer) reference this model.
// Adding a new kind = adding a spec entry, not editing switch statements.

import type { AnnotationKind } from '../types.js'

export interface AnnotationKindSpec {
  /** The CHAM annotation kind identifier. */
  readonly kind: AnnotationKind
  /** The mapped output kind used by the pipeline (e.g., 'pron' → 'pronunciation'). */
  readonly outputKind: string
  /** Canonical display ordering for serialization. Lower = earlier. */
  readonly displayOrder: number
  /** Param schema for this kind. */
  readonly params: {
    readonly required: readonly string[]
    readonly optional: readonly string[]
  }
}

/**
 * Builds an AnnotationKindSpec with sensible defaults.
 * Only `kind` is required; everything else has a default.
 */
function spec(input: {
  kind: AnnotationKind
  outputKind?: string
  displayOrder?: number
  required?: readonly string[]
  optional?: readonly string[]
}): AnnotationKindSpec {
  return {
    kind: input.kind,
    outputKind: input.outputKind ?? input.kind,
    displayOrder: input.displayOrder ?? 99,
    params: {
      required: input.required ?? [],
      optional: input.optional ?? [],
    },
  }
}

// ─── Built-in Kind Specs ───────────────────────────────────────
// Ordered by display priority: pronunciation → semantic → commentary → variant → cross-ref.
// Within each family, displayOrder is the same (grouped together).

const BUILTIN_SPECS: readonly AnnotationKindSpec[] = [
  // Pronunciation family (order 1)
  spec({ kind: 'pron', outputKind: 'pronunciation', displayOrder: 1, required: ['type', 'lang'] }),
  spec({ kind: 'pinyin', displayOrder: 1 }),
  spec({ kind: 'bpmf', displayOrder: 1 }),
  spec({ kind: 'jyutping', displayOrder: 1 }),
  // Classical phonetics (orders 2–4)
  spec({ kind: 'fanqie', displayOrder: 2, required: ['upper', 'lower'] }),
  spec({ kind: 'zhiyin', displayOrder: 3 }),
  spec({ kind: 'tone', displayOrder: 4 }),
  // Semantic (order 5)
  spec({ kind: 'meaning', outputKind: 'semantic', displayOrder: 5 }),
  // Named-entity family (order 6)
  spec({ kind: 'person', displayOrder: 6, optional: ['ref'] }),
  spec({ kind: 'place', displayOrder: 6, optional: ['ref'] }),
  spec({ kind: 'event', displayOrder: 6, optional: ['ref'] }),
  spec({ kind: 'date', displayOrder: 6, optional: ['dynasty', 'era', 'year', 'iso'] }),
  // Literary (order 7)
  spec({ kind: 'allusion', displayOrder: 7, optional: ['source'] }),
  // Commentary (order 8)
  spec({ kind: 'commentary', displayOrder: 8 }),
  // Translation (order 9 — between commentary and variant for readability)
  spec({ kind: 'translation', displayOrder: 9 }),
  // Textual criticism family (order 10)
  spec({ kind: 'collation', displayOrder: 10, optional: ['source'] }),
  spec({ kind: 'variant', displayOrder: 10, optional: ['action'] }),
  spec({ kind: 'skqs-variant', displayOrder: 10, optional: ['image', 'unicode'] }),
  // Cross-reference (order 11)
  spec({ kind: 'see-also', displayOrder: 11, optional: ['ref'] }),
  // Speaker (order 12)
  spec({ kind: 'speaker', displayOrder: 12, optional: ['ref', 'role'] }),
]

/**
 * Registry of annotation kind specs.
 * Immutable after construction — the single source of truth for kind metadata.
 *
 * Use {@link AnnotationKindRegistry.DEFAULT} for the standard built-in kinds,
 * or construct a custom registry with additional kinds for domain extensions.
 */
export class AnnotationKindRegistry {
  private readonly specs: ReadonlyMap<string, AnnotationKindSpec>

  constructor(additionalSpecs: readonly AnnotationKindSpec[] = []) {
    const map = new Map<string, AnnotationKindSpec>()
    for (const s of BUILTIN_SPECS) map.set(s.kind, s)
    for (const s of additionalSpecs) map.set(s.kind, s)
    this.specs = map
  }

  /** The standard registry with all built-in annotation kinds. */
  static readonly DEFAULT = new AnnotationKindRegistry()

  /** Get the spec for a kind, or undefined if unknown. */
  get(kind: string): AnnotationKindSpec | undefined {
    return this.specs.get(kind)
  }

  /** Whether this registry has a spec for the given kind. */
  has(kind: string): boolean {
    return this.specs.has(kind)
  }

  /** All known kind identifiers. */
  allKinds(): readonly string[] {
    return [...this.specs.keys()]
  }

  /** Map a CHAM kind to its pipeline output kind. */
  mapToOutput(kind: string): string {
    return this.specs.get(kind)?.outputKind ?? kind
  }

  /** Sort an array of kinds by their canonical display order. Stable sort. */
  sortByDisplayOrder<T>(items: readonly T[], kindOf: (item: T) => string): T[] {
    return [...items].sort((a, b) => {
      const oa = this.specs.get(kindOf(a))?.displayOrder ?? 99
      const ob = this.specs.get(kindOf(b))?.displayOrder ?? 99
      return oa - ob
    })
  }

  /** Required param names for a kind. Empty if unknown or none required. */
  requiredParams(kind: string): readonly string[] {
    return this.specs.get(kind)?.params.required ?? []
  }

  /** Optional param names for a kind. Empty if unknown or none optional. */
  optionalParams(kind: string): readonly string[] {
    return this.specs.get(kind)?.params.optional ?? []
  }
}

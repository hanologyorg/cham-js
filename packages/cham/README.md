# @hanology/cham

[![npm version](https://img.shields.io/npm/v/@hanology/cham.svg)](https://www.npmjs.com/package/@hanology/cham)

Node.js toolchain for [CHAM (Classical Han with Annotations Markup)](https://github.com/hanologyorg/cham-format) — a structured markup format for classical Chinese texts.

## Architecture

Layered, single-source-of-truth architecture with barrel exports. See [`ARCHITECTURE-SPEC.md`](../../library/TODO.annotation-refactor/ARCHITECTURE-SPEC.md) for the full specification.

```
src/
├── model/           # SSOT: AnnotationKindRegistry, target operations
├── resolver/        # Target resolution (TextIndex, TargetResolver)
├── parser/          # CHAM markdown → ChamDocument
├── serializer/      # ChamDocument → CHAM markdown
├── pipeline/        # Pure transformation + BookBuilder + LibraryBuilder
├── validation/      # Rule-based validator (25 rules, OCP)
│   └── rules/
├── epub/            # ePub → CHAM conversion
├── types/           # Domain-segregated type definitions
├── yaml-typer.ts    # YAML boundary type helpers
├── book-config-loader.ts  # Hierarchical book.yaml loading
├── registry.ts      # Registry loading (authors, dynasties, etc.)
└── cli*.ts          # CLIs (cham-epub, cham-validate)
```

## Install

```bash
npm install @hanology/cham
```

## API

### Parser & Serializer

```typescript
import { parse, serialize } from '@hanology/cham'

const doc = parse(chamSource)
// doc.meta          — frontmatter (PrimaryMeta | SecondaryMeta | PartMeta)
// doc.textBlocks    — text blocks with blank-line semantics
// doc.markers       — Map<number, Marker> from {N}...{/N} inline markers
// doc.textSections  — ### section headers within the text body
// doc.sections      — ## annotation sections with entries
// doc.parts         — optional ChamPart[] for part files

const roundTripped = serialize(doc)
```

### Dual Annotation Reference Syntax

CHAM supports two ways to reference annotation targets:

#### Inline markers (original)
```markdown
# text.cham.md
床前{1}明月{/1}光

# commentary.cham.md
{1} meaning [moonlight]
```

#### External text-quote references (new)
```markdown
# text.cham.md (no inline markers needed)
床前明月光

# commentary.cham.md
@[明月] meaning [moonlight]           # text-quote — search all verses
@3[明月] meaning [moonlight]          # with verse hint (disambiguation)
@v:0 meaning [note on entire verse]  # entire-verse reference
```

Both styles work for all annotation kinds and compose freely.

### Target Resolution

```typescript
import { TargetResolver } from '@hanology/cham'

const resolver = new TargetResolver(doc.markers, doc.textBlocks)
const resolved = resolver.resolve({ type: 'text', quote: '明月' })
// → { verseIndex: 0, charStart: 2, charEnd: 4, scope: 'verse' }
```

### Validator (Rule-Based, OCP)

```typescript
import { ChamValidator, RuleRegistry, BaseRule } from '@hanology/cham'
import type { ValidationRule, ValidationContext } from '@hanology/cham'

// Built-in validator (25 rules)
const validator = new ChamValidator()
const result = validator.validateBook('./content/my-book')

// Custom rule — register without modifying existing code
class NoAbcRule extends BaseRule implements ValidationRule {
  readonly id = 'no-abc'
  readonly category = 'quality' as const
  readonly description = 'Forbids ABC in text'
  check(ctx: ValidationContext) {
    return ctx.doc.textBlocks
      .filter(b => b.text.includes('ABC'))
      .map(b => this.warning(ctx, undefined, 'Text contains ABC'))
  }
}

const registry = RuleRegistry.DEFAULT.clone()
registry.register(new NoAbcRule())
const customValidator = new ChamValidator(registry)
```

### Custom Annotation Kind Registry

```typescript
import { ChamValidator, AnnotationKindRegistry } from '@hanology/cham'

// Register project-specific annotation kinds without forking
const customKinds = new AnnotationKindRegistry([
  {
    kind: 'phonology-gloss' as any,
    outputKind: 'phonology-gloss',
    displayOrder: 50,
    params: { required: [], optional: [] },
  },
])
const validator = new ChamValidator({ kindRegistry: customKinds })
```

### BookBuilder & LibraryBuilder (OOP Orchestrators)

```typescript
import { BookBuilder, LibraryBuilder } from '@hanology/cham'
import type { PieceSources, BookSources } from '@hanology/cham'

// Build a single book from pre-loaded sources
const bookData = new BookBuilder(config, authors).buildFromSources(pieceSources)

// Build a complete library
const libraryData = new LibraryBuilder(authors).buildFromBooks(bookSources)
```

These are pure — no filesystem access. `ChamJsonConverter` is a thin I/O adapter around them.

### YAML Boundary Type Helpers

Type-safe accessors for untrusted YAML data:

```typescript
import { asRecord, pickString, pickNumber } from '@hanology/cham'

const raw = asRecord(loadedYaml)
const name = pickString(raw, 'name') ?? 'anonymous'
const year = pickNumber(raw, 'year')  // undefined if not a number
```

### Book Config Loader

Hierarchical `book.yaml` loading with ancestor merging:

```typescript
import { loadBookConfig } from '@hanology/cham'

// Walks dir + ancestors; closer config overrides parent
const config = loadBookConfig('./content/my-book')
```

### Annotation Kind Registry (SSOT)

```typescript
import { AnnotationKindRegistry } from '@hanology/cham'

const registry = AnnotationKindRegistry.DEFAULT

registry.mapToOutput('pron')     // → 'pronunciation'
registry.mapToOutput('meaning')  // → 'semantic'
registry.requiredParams('fanqie') // → ['upper', 'lower']
```

### Per-Annotation Contributor

Multi-scholar commentary files use section-level `@contributor`:

```markdown
## 注釋
@contributor: C020    ← Guo Pu
@nature: zhu

@[多桂] commentary [桂葉似枇杷...]

## 吳任臣
@contributor: C030    ← Wu Renchen
@nature: jian

@[多桂] commentary [王會解自深桂注...]
```

The pipeline propagates `@contributor` to each `OutputAnnotation.contributor`.

### Multi-file Merge

```typescript
import { ChamParser } from '@hanology/cham'

const parser = new ChamParser()
const merged = parser.parsePiece('./content/poem-001', bookConfig)
```

### ChamJsonConverter

```typescript
import { ChamJsonConverter } from '@hanology/cham'

const converter = new ChamJsonConverter()
const bookData = converter.convertBook({
  bookDir: './content/my-book',
  outputDir: './public/data',
  authors: { A001: { name: '李白', dynasty: '唐' } },
})
```

### Sub-path Exports

```typescript
import { parse } from '@hanology/cham/parser'
import { serialize } from '@hanology/cham/serializer'
import type { ChamDocument } from '@hanology/cham/types'
import { parseYaml, loadYaml } from '@hanology/cham/yaml'
import { buildPieceFromCham } from '@hanology/cham/pipeline'
```

### CLIs

```bash
# Validate a CHAM file or book directory
npx cham-validate <path>

# Convert Wikisource EPUB to CHAM
npx cham-epub <input.epub> --id <collection-id> --title <title>
```

### Migration Scripts

Located in `scripts/`:

- `split-commentary-layers.ts` — Split multi-scholar commentary into per-scholar files
- `migrate-book-commentary.ts` — Batch migration with archiving
- `clean-text-markers.ts` — Strip `{N}` markers after migration
- `renumber-markers.ts` — Renumber marker IDs sequentially
- `repair-markers.ts` — Fix swapped marker positions
- `fix-commentary-ids.ts` — Fix commentary annotation IDs
- `fix-swapped-markers.ts` — Fix swapped marker pairs
- `normalize-frontmatter.ts` — Normalize YAML frontmatter
- `normalize-ipa.ts` — Replace IPA characters with standard Latin
- `add-missing-sections.ts` — Add missing `## 注釋` sections
- `revert-duplicate-sections.ts` — Revert duplicate section splits

## Requirements

Node.js 20+

## License

MIT

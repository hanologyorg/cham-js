# @hanology/cham

[![npm version](https://img.shields.io/npm/v/@hanology/cham.svg)](https://www.npmjs.com/package/@hanology/cham)

Node.js toolchain for [CHAM (Classical Han with Annotations Markup)](https://github.com/hanologyorg/cham-format) — a structured markup format for classical Chinese texts.

## Architecture

The package follows a layered, single-source-of-truth architecture:

```
src/
├── model/           # Domain models (SSOT for kinds, targets)
├── resolver/        # Target resolution (text index, target resolver)
├── parser/          # Parsing: text → ChamDocument
├── serializer/      # Serialization: ChamDocument → text
├── pipeline/        # Transformation: ChamDocument → OutputPiece/Book/Library
├── validation/      # Rule-based validator (OCP)
│   ├── rules/       # 25 individual rule classes
│   └── ...
├── registry.ts      # Registry loading (authors, dynasties, etc.)
├── epub.ts          # ePub converter
├── cham-json.ts     # JSON converter
└── cli*.ts          # CLIs (cham-epub, cham-validate)
```

See [`ARCHITECTURE-SPEC.md`](../../library/TODO.annotation-refactor/ARCHITECTURE-SPEC.md) for the full specification.

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

Both styles work for all annotation kinds and compose freely. External references enable:
- Clean primary text (no annotation markup)
- Independent multi-scholar commentary files
- Natural overlapping ranges
- Self-documenting references

### All Target Syntaxes

| Syntax | Target | Description |
|---|---|---|
| `{N}` | `marker` | Inline marker reference |
| `@title` | `title` | Document title |
| `@full` | `full` | Full document |
| `@verse:L:C[-E]` | `verse` | Direct verse/char position |
| `@position:L:C[-E]` | `verse` | Alias for `@verse` |
| `@v:L` | `verse-all` | Entire verse L |
| `@[text]` | `text` | Text-quote (search all verses) |
| `@L[text]` | `text` | Text-quote with verse hint |

### Target Resolution

```typescript
import { TargetResolver, TextIndex } from '@hanology/cham'

// Resolve any target to a concrete verse + char range
const resolver = new TargetResolver(doc.markers, doc.textBlocks)
const resolved = resolver.resolve({ type: 'text', quote: '明月' })
// → { verseIndex: 0, charStart: 2, charEnd: 4, scope: 'verse' }

// Non-throwing variant for validation
const maybe = resolver.tryResolve(target)
if (!maybe) console.warn('unresolvable target')
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

**Built-in rules (25):**

| Category | Rules |
|---|---|
| `frontmatter` | `frontmatter-required` |
| `marker` | `interleaving`, `uniqueness`, `integrity`, `sequential`, `annotated` |
| `target` | `target-resolution`, `verse-bounds` |
| `kind` | `kind-params`, `kind-values`, `known-kind`, `speaker` |
| `structure` | `bracket-balance`, `nested-brackets`, `text-section`, `duplicate-section` |
| `quality` | `compound-annotation`, `pinyin-ipa`, `annotation-quality`, `date-consistency`, `nature-valid` |
| `registry` | `registry-refs`, `dynasty-refs` |
| `config` | `book-config`, `hierarchy` |

### Annotation Kind Registry (SSOT)

```typescript
import { AnnotationKindRegistry } from '@hanology/cham'

const registry = AnnotationKindRegistry.DEFAULT

registry.mapToOutput('pron')     // → 'pronunciation'
registry.mapToOutput('meaning')  // → 'semantic'
registry.requiredParams('fanqie') // → ['upper', 'lower']
registry.has('collation')        // → true
```

### Multi-file Merge

Parse an entire piece directory (primary + secondary files):

```typescript
import { ChamParser } from '@hanology/cham'

const parser = new ChamParser()
const merged = parser.parsePiece('./content/poem-001', bookConfig)
```

Merges secondary files, validates marker cross-references, inherits `contributors`/`date`/`genre` from `book.yaml`, and discovers `part-*.cham.md` files.

### Per-Annotation Contributor

Multi-scholar commentary files can use section-level `@contributor` to attribute annotations:

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

### ChamJsonConverter

Convert book/library directories to JSON for frontend consumption:

```typescript
import { ChamJsonConverter } from '@hanology/cham'

const converter = new ChamJsonConverter()
const bookData = converter.convertBook({
  bookDir: './content/my-book',
  outputDir: './public/data',
  authors: { A001: { name: '李白', dynasty: '唐' } },
})
```

### Pipeline (Pure Transformations)

Headless transformation functions with no filesystem dependency:

```typescript
import {
  buildPieceFromCham, buildBookMeta, buildBookData,
  buildLibraryIndex, buildCrossRefs, detectScale,
  buildAuthorsJson, buildDynastiesJson,
  buildAnnotations, getHeadword, buildAnnotationsText,
} from '@hanology/cham/pipeline'
```

### Registry & Lexicon

Load CHAM registry data and apply lexicon-based pronunciation annotations:

```typescript
import { RegistryLoader, LexiconApplier } from '@hanology/cham'

const registries = new RegistryLoader().loadAll('./data')
// registries.authors, .dynasties, .eras, .places, .events, .lexicon, .works, .sources
```

### Sub-path Exports

```typescript
import { parse } from '@hanology/cham/parser'
import { serialize } from '@hanology/cham/serializer'
import type { ChamDocument, PrimaryMeta } from '@hanology/cham/types'
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

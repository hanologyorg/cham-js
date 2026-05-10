# @hanology/cham

[![npm version](https://img.shields.io/npm/v/@hanology/cham.svg)](https://www.npmjs.com/package/@hanology/cham)

Node.js toolchain for [CHAM (Classical Han with Annotations Markup)](https://github.com/hanologyorg/cham-format) — a structured markup format for classical Chinese texts.

## Install

```bash
npm install @hanology/cham
```

## API

### Parser & Serializer

```typescript
import { parse, serialize } from '@hanology/cham'

const doc = parse(chamSource)
// doc.meta — frontmatter (PrimaryMeta | SecondaryMeta)
// doc.textBlocks — text blocks with blank-line semantics
// doc.markers — Map<number, Marker> from {N}...{/N} inline markers
// doc.sections — annotation sections with entries

const roundTripped = serialize(doc)
```

Supports all spec features: overlapping/enclosed markers, multi-line annotation values, section metadata, all annotation kinds (`pron`, `meaning`, `person`, `place`, `event`, `date`, `allusion`, `commentary`, `translation`, `collation`, `variant`, `see-also`), and all target types (`{N}`, `@title`, `@full`, `@verse:L:C[-E]`).

### Multi-file Merge

Parse an entire piece directory (primary + subordinate `.cham.md` files):

```typescript
import { ChamParser } from '@hanology/cham'

const parser = new ChamParser()
const merged = parser.parsePiece('./content/poem-001', bookConfig)
```

Merges subordinate files, validates marker cross-references, and inherits `contributors`, `date`, and `genre` from `book.yaml`.

### Validator

Validate a single file or an entire book directory:

```typescript
import { ChamValidator } from '@hanology/cham'

const validator = new ChamValidator()

// Single file
const result = validator.validateFile('./text.cham.md')

// Full book directory
const bookResult = validator.validateBook('./content/my-book')

// With registry cross-references
const fullResult = validator.validateBookWithRegistries('./content/my-book', './data')
```

Checks: frontmatter required fields, marker balance and interleaving, annotation ref integrity, kind-specific parameter validation, bracket balance, subordinate file rules, section name dedup, and registry ref resolution.

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

const { library, allPieces } = converter.convertLibrary({
  libraryDir: './content',
  outputDir: './public/data',
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
const applier = new LexiconApplier({ entries: registries.lexicon, defaultLang: 'yue' })
const autoAnnotations = applier.apply(doc, existingAnnotations)
```

Registries: `authors.yaml`, `dynasties.yaml`, `eras.yaml`, `sexagenary.yaml`, `places.yaml`, `events.yaml`, `lexicon.yaml`.

### Sub-path Exports

```typescript
import { parse } from '@hanology/cham/parser'
import { serialize } from '@hanology/cham/serializer'
import type { ChamDocument, PrimaryMeta } from '@hanology/cham/types'
import { parseYaml, loadYaml } from '@hanology/cham/yaml'
import { buildPieceFromCham, ... } from '@hanology/cham/pipeline'
```

### ePub Converter

Convert Wikisource Siku Quanshu ePub files to CHAM format:

```bash
npx cham-epub 帝學_\(四庫全書本\).epub --id skqs-dixue --title 帝學
```

## Requirements

Node.js 20+

## License

MIT

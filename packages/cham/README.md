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
const roundTripped = serialize(doc)
```

### Multi-file Merge

Parse an entire piece directory (primary + subordinate `.cham.md` files):

```typescript
import { ChamParser } from '@hanology/cham'

const parser = new ChamParser()
const merged = parser.parsePiece('./content/poem-001', bookConfig)
```

### Validator

Validate a single file or an entire book directory:

```typescript
import { ChamValidator } from '@hanology/cham'

const validator = new ChamValidator()
const result = validator.validateBook('./content/my-book')
if (!result.valid) {
  for (const issue of result.issues) console.log(`${issue.severity}: ${issue.message}`)
}
```

With registry cross-reference validation:

```typescript
const result = validator.validateBookWithRegistries('./content/my-book', './data')
```

### ChamJsonConverter

Convert book/library directories to JSON for frontend consumption:

```typescript
import { ChamJsonConverter } from '@hanology/cham'

const converter = new ChamJsonConverter()
const { library, allPieces } = converter.convertLibrary({
  libraryDir: './content',
  outputDir: './public/data',
  authors: { A001: { name: '李白', dynasty: '唐' } },
})
```

### Registry & Lexicon

Load CHAM registry data (authors, dynasties, places, events, etc.) and apply lexicon-based pronunciation annotations:

```typescript
import { RegistryLoader, LexiconApplier } from '@hanology/cham'

const registries = new RegistryLoader().loadAll('./data')
const applier = new LexiconApplier({ entries: registries.lexicon, defaultLang: 'yue' })
const autoAnnotations = applier.apply(doc, existingAnnotations)
```

### Sub-path Exports

```typescript
import { parse } from '@hanology/cham/parser'
import { serialize } from '@hanology/cham/serializer'
import type { ChamDocument, PrimaryMeta } from '@hanology/cham/types'
import { parseYaml } from '@hanology/cham/yaml'
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

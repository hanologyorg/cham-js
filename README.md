# CHAM Monorepo

[![CI](https://github.com/hanology/cham-js/actions/workflows/ci.yml/badge.svg)](https://github.com/hanology/cham-js/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/@hanology/cham.svg)](https://www.npmjs.com/package/@hanology/cham)

TypeScript implementation of [CHAM (Classical Han with Annotations Markup)](https://github.com/hanology/cham-format) — a structured markup format for classical Chinese texts.

## Packages

| Package | Description |
|---------|-------------|
| [`@hanology/cham`](./packages/cham/) | Full Node.js toolchain: parser, serializer, validator, registry loader, lexicon, ePub converter, CHAM-JSON pipeline |
| [`@hanology/cham-browser`](./packages/cham-browser/) | Browser-compatible build: parser, serializer, and types only |

## Install

```bash
# Node.js — full toolchain
npm install @hanology/cham

# Browser — parser & serializer only
npm install @hanology/cham-browser
```

## Quick start

```typescript
import { parse, serialize } from '@hanology/cham'

const doc = parse(chamSource)
const roundTripped = serialize(doc)
```

## Features

### Parser & Serializer

Parse CHAM source into a structured document model, and serialize back to CHAM format. Round-trip equivalence is guaranteed.

```typescript
import { ChamParser, ChamSerializer } from '@hanology/cham'

const parser = new ChamParser()
const doc = parser.parse(source)

// Multi-file mode: merge subordinate .cham.md files
const merged = parser.parsePiece('./path/to/piece-dir', bookConfig)

const serializer = new ChamSerializer()
const output = serializer.serialize(merged)
```

### Validator

Validate book directories and individual files against the CHAM spec:

- Frontmatter required fields
- Marker interleaving (stack-based detection of `{1}{2}{/1}` violations)
- Kind-specific parameter validation (e.g., `pron` requires `type` and `lang`)
- Bracket balance in annotation values
- Subordinate file constraints (no text content or inline markers)
- Section name deduplication across files
- Registry reference validation

```typescript
import { ChamValidator } from '@hanology/cham'

const validator = new ChamValidator()
const result = validator.validateBook('./my-book')
console.log(result.valid, result.issues)

// With registry validation
const result2 = validator.validateBookWithRegistries('./my-book', './data')
```

### Registry Loader

Load reference data from YAML registries: authors, dynasties, eras, sexagenary cycle, places, events, and lexicon.

```typescript
import { RegistryLoader } from '@hanology/cham'

const loader = new RegistryLoader()
const registries = loader.loadAll('./data')
```

### Lexicon

Apply pronunciation annotations from a global lexicon to uncovered text positions:

```typescript
import { LexiconApplier } from '@hanology/cham'

const applier = new LexiconApplier({ entries: lexiconEntries, defaultLang: 'cmn' })
const annotations = applier.apply(doc, existingAnnotations)
```

### CHAM-JSON Converter

Convert book/library directories to JSON output for frontend consumption:

```typescript
import { ChamJsonConverter } from '@hanology/cham'

const converter = new ChamJsonConverter()
const bookData = converter.convertBook({ bookDir: './my-book', outputDir: './output' })
```

### ePub Converter

Convert Wikisource Siku Quanshu ePub files to CHAM directories:

```bash
cham-epub 帝學_\(四庫全書本\).epub --id skqs-dixue --title 帝學
```

## Development

```bash
npm install         # install all workspace deps
npm run build       # build all packages
npm test            # run tests (66 tests across 5 test files)
```

Requires Node.js 20+.

## License

MIT

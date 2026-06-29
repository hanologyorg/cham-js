# CHAM Monorepo

[![CI](https://github.com/hanologyorg/cham-js/actions/workflows/ci.yml/badge.svg)](https://github.com/hanologyorg/cham-js/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/@hanology/cham.svg)](https://www.npmjs.com/package/@hanology/cham)
[![npm version](https://img.shields.io/npm/v/@hanology/cham-browser.svg)](https://www.npmjs.com/package/@hanology/cham-browser)

TypeScript implementation of [CHAM (Classical Han with Annotations Markup)](https://github.com/hanologyorg/cham-format) — a structured markup format for classical Chinese texts.

## Packages

| Package | Description |
|---------|-------------|
| [`@hanology/cham`](./packages/cham/) | Node.js toolchain: parser, serializer, rule-based validator, BookBuilder/LibraryBuilder pipeline, YAML type helpers, ePub converter |
| [`@hanology/cham-browser`](./packages/cham-browser/) | Site generator: pure pipeline functions, Vue 3 template, CLI (`cham-browser --config config.yaml`) |

## Architecture Highlights

- **Dual annotation referencing**: inline `{N}...{/N}` markers AND external `@[quote]` text-quote references
- **Single source of truth** for annotation kinds, target types, and validation rules
- **Rule-based validator** (OCP): 25 rules; new rules added without modifying existing code
- **Custom AnnotationKindRegistry injection** for project-specific kinds
- **BookBuilder / LibraryBuilder** OOP orchestrators — pure pipeline entry points
- **Per-annotation contributor** attribution for multi-scholar commentaries
- **YAML boundary type safety**: `asRecord`, `pickString`, `pickNumber` at every system boundary
- **Hierarchical book.yaml loading**: ancestor configs merged automatically
- **Open/closed** throughout: extend by adding files, not editing existing ones

See [`library/TODO.annotation-refactor/ARCHITECTURE-SPEC.md`](./library/TODO.annotation-refactor/ARCHITECTURE-SPEC.md) for the full architecture specification.

## Install

```bash
# Node.js toolchain
npm install @hanology/cham

# Site generator
npm install @hanology/cham-browser
```

## Quick start

### Parser & Serializer

```typescript
import { parse, serialize } from '@hanology/cham'

const doc = parse(chamSource)
const roundTripped = serialize(doc)
```

### BookBuilder & LibraryBuilder

```typescript
import { BookBuilder, LibraryBuilder } from '@hanology/cham'

const bookData = new BookBuilder(config, authors).buildFromSources(pieces)
const libraryData = new LibraryBuilder(authors).buildFromBooks(books)
```

### Rule-based Validator

```typescript
import { ChamValidator, RuleRegistry, BaseRule } from '@hanology/cham'

const validator = new ChamValidator()
const result = validator.validateBook('./content/my-book')

// Register a custom rule without modifying existing code
const registry = RuleRegistry.DEFAULT.clone()
registry.register(new MyCustomRule())
const customValidator = new ChamValidator(registry)
```

### Site Generator

```bash
npx @hanology/cham-browser --config config.yaml
```

## Development

```bash
npm install         # install all workspace deps
npm run build       # build all packages
npm test            # run tests (472 tests across 25 files)
```

Requires Node.js 20+.

## License

MIT

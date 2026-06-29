# CHAM Monorepo

[![CI](https://github.com/hanologyorg/cham-js/actions/workflows/ci.yml/badge.svg)](https://github.com/hanologyorg/cham-js/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/@hanology/cham.svg)](https://www.npmjs.com/package/@hanology/cham)
[![npm version](https://img.shields.io/npm/v/@hanology/cham-browser.svg)](https://www.npmjs.com/package/@hanology/cham-browser)

TypeScript implementation of [CHAM (Classical Han with Annotations Markup)](https://github.com/hanologyorg/cham-format) — a structured markup format for classical Chinese texts.

## Packages

| Package | Description |
|---------|-------------|
| [`@hanology/cham`](./packages/cham/) | Node.js toolchain: parser, serializer, validator (rule-based), CHAM-JSON pipeline, ePub converter |
| [`@hanology/cham-browser`](./packages/cham-browser/) | Site generator: pure pipeline functions, Vue 3 template, CLI (`cham-browser --config config.yaml`) |

## Architecture Highlights

- **Dual annotation referencing**: inline `{N}...{/N}` markers AND external `@[quote]` text-quote references
- **Single source of truth** for annotation kinds, target types, and validation rules
- **Rule-based validator** (OCP): new validation rules added without modifying existing code
- **Per-annotation contributor** attribution for multi-scholar commentaries
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

### Dual Reference Syntax

CHAM supports two ways to reference annotation targets:

```markdown
# Primary text (text.cham.md)
{1}明月{/1}光    ← inline markers (original)

# Commentary (any .cham.md file)
{1} meaning [moonlight]           ← marker reference (original)
@[明月] meaning [moonlight]        ← external text-quote reference (new)
@3[明月] meaning [moonlight]       ← with verse hint for disambiguation
@v:0 meaning [entire verse note]  ← entire-verse reference
```

Both reference styles work for **all** annotation kinds and compose freely.

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
npm test            # run tests (398 tests across 22 files)
```

Requires Node.js 20+.

## License

MIT

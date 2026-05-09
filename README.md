# @hanology/cham

[![CI](https://github.com/hanology/cham-js/actions/workflows/ci.yml/badge.svg)](https://github.com/hanology/cham-js/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/@hanology/cham.svg)](https://www.npmjs.com/package/@hanology/cham)

TypeScript implementation of [CHAM (Classical Han with Annotations Markup)](https://github.com/hanology/cham-format) — a structured markup format for classical Chinese texts.

Provides a parser, serializer, validator, ePub-to-CHAM converter, and a CHAM-to-JSON pipeline.

## Install

```bash
npm install @hanology/cham
```

## API

### Parse & serialize

```typescript
import { parse, serialize } from '@hanology/cham'

const chamSource = `---
id: 1
title: 垓下歌
genre: poetry
---

力拔山兮氣蓋世。

時不利兮{1}騅{/1}不逝。

## 注釋

{1} meaning [騅][項羽的馬名]`

const doc = parse(chamSource)
// doc.meta     → { type: 'primary', id: 1, title: '垓下歌', genre: 'poetry' }
// doc.textBlocks → [{ text: '力拔山兮氣蓋世。', ... }, ...]
// doc.markers  → Map { 1 => { id: 1, offset: 5, length: 1, text: '騅' } }
// doc.sections → [{ name: '注釋', entries: [...] }]

const roundTripped = serialize(doc)
```

### Validate

```typescript
import { ChamValidator } from '@hanology/cham'

const validator = new ChamValidator()

// Validate a single CHAM file
const result = validator.validateFile('content/001_垓下歌/text.cham.md')

// Validate an entire book directory
const bookResult = validator.validateBook('content/老子')

console.log(result.valid)   // boolean
console.log(result.issues)  // ValidationIssue[]
```

### Convert CHAM to JSON

```typescript
import { ChamJsonConverter } from '@hanology/cham'

const converter = new ChamJsonConverter()

// Convert a single book
const bookData = converter.convertBook({
  bookDir: 'content/老子',
  outputDir: 'output/books',
  authors: { Laozi: { name: '老子', dynasty: '周' } },
})

// Convert an entire library
const library = converter.convertLibrary({
  libraryDir: 'content',
  outputDir: 'output',
})
```

### Convert ePub to CHAM

```typescript
import { EpubConverter } from '@hanology/cham'

const converter = new EpubConverter()
converter.convert({
  epubPath: '帝學_(四庫全書本).epub',
  outputDir: 'output/skqs-dixue',
  bookConfig: {
    id: 'skqs-dixue',
    title: '帝學',
    subtitle: '四庫全書本',
    genre: 'prose',
  },
  layerContributor: '四庫全書館臣',
})
```

## CLI

```bash
npx cham-epub <epub-path> [output-dir] [options]
```

Options:

| Flag | Description |
|------|-------------|
| `--id` | Book ID (auto-derived if omitted) |
| `--title` | Book title |
| `--subtitle` | Subtitle |
| `--genre` | Genre: `prose` \| `poetry` \| `mixed` \| `drama` |
| `--contributor` | Contributor in `ref:role` format (repeatable) |
| `--layer-contributor` | Commentary layer contributor |
| `--dynasty` / `--era` / `--era-year` | Date metadata |

## CHAM format

CHAM files (`.cham.md`) encode classical Chinese text with inline annotation markers, annotation entries, and YAML frontmatter. Key features:

- **Inline markers** `{N}...{/N}` — zero-width, support overlapping and enclosed ranges
- **Annotation entries** — target markers, title, full text, or verse positions with extensible `kind` values (`pron`, `meaning`, `person`, `place`, `event`, `date`, `allusion`, `commentary`, `translation`, `collation`, `variant`, etc.)
- **Multi-file layers** — separate `*.cham.md` files share a common marker table
- **Round-trip equivalence** — parse then serialize preserves all semantic content

See the [CHAM specification](https://github.com/hanology/cham-format) for full details.

## Development

```bash
npm run build    # TypeScript → dist/
npm test         # vitest run
```

Requires Node.js 20+.

## License

MIT

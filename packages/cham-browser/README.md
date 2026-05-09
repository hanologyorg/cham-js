# @hanology/cham-browser

[![npm version](https://img.shields.io/npm/v/@hanology/cham-browser.svg)](https://www.npmjs.com/package/@hanology/cham-browser)

Site generator for [CHAM (Classical Han with Annotations Markup)](https://github.com/hanologyorg/cham-format) — generates a complete static website from CHAM content.

Includes parser, serializer, transformation pipeline, Vue 3 frontend template, and CLI.

## Install

```bash
npm install @hanology/cham-browser
```

## CLI

```bash
# Generate a static site from CHAM content
npx cham-browser --config config.yaml
```

### config.yaml

```yaml
# Branding
name: 漢流
nameEn: Hanology
subtitle: 古典詩文圖書館

# Content paths (relative to config.yaml)
libraryDir: library/content
authorsFile: library/data/authors.yaml

# Build options
outputDir: dist
pretty: true
```

## API

### Parser & Serializer (browser-compatible)

```typescript
import { parse, serialize } from '@hanology/cham-browser'

const doc = parse(chamSource)
const output = serialize(doc)
```

### Pipeline (pure functions, no Node.js fs)

```typescript
import {
  buildPieceFromCham,
  buildBookData,
  buildLibraryIndex,
  buildAuthorsJson,
  buildDynastiesJson,
} from '@hanology/cham-browser'

const piece = buildPieceFromCham(
  chamSource, bookConfig, authors, bookId,
  proseFiles, layerFiles,
)
```

## Architecture

| Layer | Description |
|-------|-------------|
| `pipeline.ts` | Pure transformation functions (CHAM → JSON) |
| `cli.ts` | I/O adapter: reads files, calls pipeline, runs vite-ssg |
| `template/` | Vue 3 + vite-ssg frontend (components, views, styles) |

## Requirements

Node.js 20+

## License

MIT

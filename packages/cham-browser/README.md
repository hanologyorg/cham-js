# @hanology/cham-browser

[![npm version](https://img.shields.io/npm/v/@hanology/cham-browser.svg)](https://www.npmjs.com/package/@hanology/cham-browser)

Site generator for [CHAM (Classical Han with Annotations Markup)](https://github.com/hanologyorg/cham-format) — generates a complete static website from CHAM content.

Built on [`@hanology/cham`](../cham/) and adds a Vue 3 frontend template with vite-ssg.

## Architecture

| Layer | Description |
|-------|-------------|
| `pipeline.ts` | Pure transformation functions (CHAM → JSON) — re-exports from `@hanology/cham` |
| `cli.ts` | I/O adapter: reads files, calls pipeline, runs vite-ssg |
| `template/` | Vue 3 + vite-ssg frontend (components, views, styles) |

The pipeline layer is **filesystem-free**: all transformation functions accept in-memory inputs (strings, Maps) and return plain JSON objects. This makes them testable without fs mocks and reusable in browser contexts.

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

### Dual Annotation References

The pipeline fully supports both inline `{N}` markers and external `@[quote]` text-quote references. See [`@hanology/cham` README](../cham/README.md) for the full syntax guide.

### Multi-Scholar Commentary Layers

The pipeline groups secondary files into `OutputAnnotationLayer[]` based on `book.yaml` layer definitions. Each layer has its own contributor, display label, and toggle state.

```yaml
# book.yaml
layers:
  - id: guopu
    label: 郭璞注
    shortLabel: 郭
    contributor: C020
    role: annotator
    nature: zhu
  - id: wurenchen
    label: 吳任臣廣注
    shortLabel: 吳
    contributor: C030
    role: annotator
    nature: jian
```

The frontend renders each layer as an independently toggleable commentary column.

## Frontend Template

The `template/` directory contains a Vue 3 + vite-ssg application:

- `template/components/` — Vue components (verse display, annotation tooltips, navigation)
- `template/views/` — Page views (library index, book detail, piece reader)
- `template/styles/` — CSS
- `template/__tests__/` — Component and composable tests (14 test files, 62 tests)

## Requirements

Node.js 20+

## License

MIT

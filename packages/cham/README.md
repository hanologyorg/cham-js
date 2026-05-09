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

### Sub-path Exports

```typescript
import { parse } from '@hanology/cham/parser'
import { serialize } from '@hanology/cham/serializer'
import type { ChamDocument, PrimaryMeta } from '@hanology/cham/types'
import { parseYaml } from '@hanology/cham/yaml'
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

### ePub Converter

```bash
npx cham-epub 帝學_\(四庫全書本\).epub --id skqs-dixue --title 帝學
```

## Requirements

Node.js 20+

## License

MIT

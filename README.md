# CHAM Monorepo

[![CI](https://github.com/hanology/cham-js/actions/workflows/ci.yml/badge.svg)](https://github.com/hanology/cham-js/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/@hanology/cham.svg)](https://www.npmjs.com/package/@hanology/cham)

TypeScript implementation of [CHAM (Classical Han with Annotations Markup)](https://github.com/hanology/cham-format) — a structured markup format for classical Chinese texts.

## Packages

| Package | Description |
|---------|-------------|
| [`@hanology/cham`](./packages/cham/) | Full Node.js toolchain: parser, serializer, validator, ePub converter, CHAM-JSON pipeline |
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

See [`packages/cham/README.md`](./packages/cham/) for full API documentation.

## Development

```bash
npm install         # install all workspace deps
npm run build       # build all packages
npm test            # run tests
```

Requires Node.js 20+.

## License

MIT

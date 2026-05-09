# CHAM Monorepo

[![CI](https://github.com/hanology/cham-js/actions/workflows/ci.yml/badge.svg)](https://github.com/hanology/cham-js/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/@hanology/cham.svg)](https://www.npmjs.com/package/@hanology/cham)
[![npm version](https://img.shields.io/npm/v/@hanology/cham-browser.svg)](https://www.npmjs.com/package/@hanology/cham-browser)

TypeScript implementation of [CHAM (Classical Han with Annotations Markup)](https://github.com/hanology/cham-format) — a structured markup format for classical Chinese texts.

## Packages

| Package | Description |
|---------|-------------|
| [`@hanology/cham`](./packages/cham/) | Node.js toolchain: parser, serializer, validator, CHAM-JSON pipeline, ePub converter |
| [`@hanology/cham-browser`](./packages/cham-browser/) | Site generator: pure pipeline functions, Vue 3 template, CLI (`cham-browser --config config.yaml`) |

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

### Site Generator

```bash
npx @hanology/cham-browser --config config.yaml
```

## Development

```bash
npm install         # install all workspace deps
npm run build       # build all packages
npm test            # run tests
```

Requires Node.js 20+.

## License

MIT

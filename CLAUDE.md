# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

This is a monorepo for the CHAM (Classical Han with Annotations Markup) toolchain. CHAM is a structured markup format for classical Chinese texts.

```
packages/
  cham/            → @hanology/cham (core: parser, serializer, validator, converters, CLI)
  cham-browser/    → @hanology/cham-browser (browser re-export of parser + serializer only)
```

The CHAM spec lives at https://github.com/hanology/cham-format.

## Build & test commands

```bash
npm run build      # build all workspaces
npm test           # vitest run in packages/cham (currently no test files)
npm run clean      # rm dist/ and node_modules/ from all packages
```

To build/test a single workspace:
```bash
npm run build --workspace=packages/cham
npm run test --workspace=packages/cham
```

The CI workflow also references `npm run lint` but no linting is configured yet.

## Architecture

All core source is in `packages/cham/src/`. The module is ESM-only, targets ES2022, and uses `NodeNext` module resolution (import paths must include `.js` extension).

### Core pipeline

```
packages/cham/src/
  yaml.ts          → Shared minimal YAML parser (parseYaml, loadYaml)
  parser.ts        → ChamParser: .cham.md source string → ChamDocument
  serializer.ts    → ChamSerializer: ChamDocument → .cham.md source string
  validator.ts     → ChamValidator: validates book directories and single files
  cham-json.ts     → ChamJsonConverter: book/library directories → JSON output
  epub.ts          → EpubConverter: ePub files → CHAM book directories
  types.ts         → All type definitions
  index.ts         → Public API re-exports
  cli.ts           → CLI entry point (cham-epub command)
```

### Key data model

- **ChamDocument**: central type — `meta` (frontmatter), `textBlocks`, `markers` (Map<number, Marker>), `sections` (annotation sections).
- **ChamMeta** is a discriminated union: `PrimaryMeta` (main file) vs `SecondaryMeta` (subordinate file with `base` field).
- **Markers** (`{N}`...`{/N}`) are zero-width, support overlapping and enclosed ranges. Parser strips them to produce clean text and builds a marker table mapping IDs to offsets.
- **Annotation entries** target markers, `@title`, `@full`, or `@verse:L:C`, with a `kind` and bracket-enclosed values.

### YAML parsing

`yaml.ts` exports `parseYaml()` and `loadYaml()` — used by parser.ts, cham-json.ts, and validator.ts. No external YAML dependency.

### ePub converter

Specifically designed for Siku Quanshu (四庫全書) ePub files. Extracts XHTML, detects `<small>` tags as annotations, produces CHAM directories.

### Browser package

`cham-browser` re-exports only parser + serializer (no Node.js deps like `fs`, `fflate`).

## Known gaps against spec

See `TODO.features/` for tracked improvement items including registry loading, global lexicon, multi-file merge, and validator enhancements.

## Dependencies

- `fflate` — used only by the ePub converter for ZIP extraction (packages/cham only)
- Dev: `typescript`, `vitest`, `@types/node`

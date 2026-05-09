# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

Monorepo for the CHAM (Classical Han with Annotations Markup) toolchain and site generator. CHAM is a structured markup format for classical Chinese texts.

```
packages/
  cham/            → @hanology/cham (core: parser, serializer, validator, CHAM-JSON pipeline, ePub, CLI)
  cham-browser/    → @hanology/cham-browser (site generator: pipeline, Vue 3 template, CLI)
```

The CHAM spec lives at https://github.com/hanology/cham-format.

## Build & test commands

```bash
npm run build      # build all workspaces
npm test           # vitest run in packages/cham
npm run clean      # rm dist/ and node_modules/ from all packages
```

To build/test a single workspace:
```bash
npm run build --workspace=packages/cham
npm run test --workspace=packages/cham
```

## Architecture

### @hanology/cham (`packages/cham/src/`)

ESM-only, targets ES2022, `NodeNext` module resolution (import paths must include `.js` extension).

```
yaml.ts          → Minimal YAML parser (parseYaml, loadYaml)
parser.ts        → ChamParser: .cham.md source → ChamDocument
serializer.ts    → ChamSerializer: ChamDocument → .cham.md source
validator.ts     → ChamValidator: validates book directories and files
cham-json.ts     → ChamJsonConverter: book/library dirs → JSON (uses fs)
types.ts         → All type definitions
index.ts         → Public API re-exports
cli.ts           → CLI entry point (cham-epub command)
```

Sub-path exports: `@hanology/cham/parser`, `@hanology/cham/serializer`, `@hanology/cham/types`, `@hanology/cham/yaml`.

### @hanology/cham-browser (`packages/cham-browser/`)

Three-layer architecture:

1. **`src/pipeline.ts`** — Pure transformation functions (no fs). CHAM source → OutputPiece, BookData, LibraryIndex, authors.json, dynasties.json. All functions accept pre-loaded strings/Maps instead of file paths.

2. **`src/cli.ts`** — I/O adapter. Reads config.yaml, scans library directories, loads CHAM files, calls pipeline functions, writes JSON, runs vite-ssg build.

3. **`template/`** — Vue 3 + vite-ssg frontend template. Contains components, views, composables, styles. Included as-is in npm package; compiled by vite at build time.

### Key data model

- **ChamDocument**: `meta` (frontmatter), `textBlocks`, `markers` (Map<number, Marker>), `sections` (annotation sections)
- **ChamMeta**: discriminated union — `PrimaryMeta` vs `SecondaryMeta`
- **Markers** (`{N}`...`{/N}`): zero-width, overlapping ranges
- **Blank-line semantics**: 1 newline = continuation, 2 = block boundary, 3+ = section break

## Dependencies

- `fflate` — ePub converter only (packages/cham)
- `yaml` — full YAML parsing in CLI (packages/cham-browser)
- `vue`, `vue-router`, `vite`, `vite-ssg` — frontend build (packages/cham-browser)
- Dev: `typescript`, `vitest`, `@types/node`

## Publishing

Tag-based release via GHA: `git tag cham/vX.Y.Z` or `git tag cham-browser/vX.Y.Z`. Uses npm trusted publishing (`--provenance`). See `.github/workflows/release.yml`.

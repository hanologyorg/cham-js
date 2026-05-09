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
npm test           # vitest run in packages/cham
npm run clean      # rm dist/ and node_modules/ from all packages
```

To build/test a single workspace:
```bash
npm run build --workspace=packages/cham
npm run test --workspace=packages/cham
```

## Architecture

All core source is in `packages/cham/src/`. The module is ESM-only, targets ES2022, and uses `NodeNext` module resolution (import paths must include `.js` extension).

### Core pipeline

```
packages/cham/src/
  yaml.ts          → Shared minimal YAML parser (parseYaml, loadYaml)
  parser.ts        → ChamParser: .cham.md source string → ChamDocument
                     ChamParser.parsePiece(): multi-file merge from directory
  serializer.ts    → ChamSerializer: ChamDocument → .cham.md source string
  validator.ts     → ChamValidator: validates book directories and single files
                     Checks: frontmatter fields, marker interleaving, kind params,
                     bracket balance, subordinate file constraints, registry refs
  cham-json.ts     → ChamJsonConverter: book/library directories → JSON output
                     Nearest ancestor book.yaml traversal for inheritance
  registry.ts      → RegistryLoader: loads 6 registry YAML files (authors, dynasties,
                     eras, sexagenary, places, events) + lexicon
  lexicon.ts       → LexiconApplier: scans text against lexicon, creates pronunciation
                     annotations for uncovered positions
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
- **Blank-line semantics**: 1 newline = continuation (same block), 2 newlines = block boundary, 3+ newlines = section break.

### YAML parsing

`yaml.ts` exports `parseYaml()` and `loadYaml()` — used by parser.ts, cham-json.ts, validator.ts, and registry.ts. Auto-detects arrays from `- ` prefix. No external YAML dependency.

### Multi-file mode

`ChamParser.parsePiece(pieceDir, bookConfig?)` loads `text.cham.md` as primary, then merges subordinate `*.cham.md` files (those with `base:` frontmatter). Validates marker refs, applies book.yaml inheritance for contributors/date/genre.

### Inheritance

`ChamJsonConverter` walks up the directory tree to find ancestor `book.yaml` files, merging with nearest-first precedence. Inheritable fields: `contributors`, `date`, `genre`.

### Registries

`RegistryLoader.loadAll(dataDir)` loads 6 YAML registries + lexicon. Used by `ChamValidator.validateBookWithRegistries()` for ref validation. Registry types: `AuthorRecord`, `DynastyRecord`, `EraRecord`, `SexagenaryRecord`, `PlaceRecord`, `EventRecord`, `LexiconEntry`.

### ePub converter

Specifically designed for Siku Quanshu (四庫全書) ePub files. Extracts XHTML, detects `<small>` tags as annotations, produces CHAM directories.

### Browser package

`cham-browser` re-exports only parser + serializer (no Node.js deps like `fs`, `fflate`).

## Dependencies

- `fflate` — used only by the ePub converter for ZIP extraction (packages/cham only)
- Dev: `typescript`, `vitest`, `@types/node`

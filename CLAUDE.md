# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

`@hanology/cham` is a TypeScript library implementing the CHAM (Classical Han with Annotations Markup) format — a structured markup format for classical Chinese texts. It provides a parser, serializer, validator, ePub-to-CHAM converter, and a CHAM-to-JSON pipeline.

The CHAM spec lives at https://github.com/hanology/cham-format.

## Build & test commands

```bash
npm run build    # tsc → dist/
npm test         # vitest run
```

There are no test files yet. The CI workflow also references `npm run lint` and `npm run test:coverage`, but these scripts don't exist in package.json yet.

No linting is configured. When adding it, update both package.json scripts and the CI workflow.

## Architecture

All source is in `src/`. The module is ESM-only (`"type": "module"`), targets ES2022, and uses `NodeNext` module resolution (import paths must include `.js` extension).

### Core pipeline

```
src/parser.ts      → ChamParser: .cham.md source string → ChamDocument
src/serializer.ts  → ChamSerializer: ChamDocument → .cham.md source string
src/validator.ts   → ChamValidator: validates book directories and single files
src/cham-json.ts   → ChamJsonConverter: book/library directories → JSON output (BookData, LibraryIndex)
src/epub.ts        → EpubConverter: ePub files → CHAM book directories
src/types.ts       → All type definitions (ChamDocument, AnnotationEntry, Marker, etc.)
src/index.ts       → Public API re-exports
src/cli.ts         → CLI entry point (cham-epub command)
```

### Key data model

- **ChamDocument**: the central type — contains `meta` (frontmatter), `textBlocks`, `markers` (Map<number, Marker>), and `sections` (annotation sections).
- **ChamMeta** is a discriminated union: `PrimaryMeta` (main file, no `base` field) vs `SecondaryMeta` (subordinate file, has `base` field).
- **Markers** (`{N}`...`{/N}`) are zero-width, support overlapping and enclosed ranges. The parser strips them to produce clean text and builds a marker table mapping IDs to offsets.
- **Annotation entries** target markers (`{N}`), `@title`, `@full`, or `@verse:L:C`, with a `kind` (pron, meaning, person, etc.) and bracket-enclosed values.

### YAML parsing

Both `parser.ts` and `cham-json.ts` contain their own minimal YAML parsers (`parseYamlSimple` / `parseSimpleYaml`). There is no YAML library dependency — the format is restricted enough that hand-rolled parsing suffices. The validator in `validator.ts` also has its own copy.

### ePub converter

The ePub converter (`src/epub.ts`) is specifically designed for Siku Quanshu (四庫全書) ePub files. It extracts XHTML content, detects inline `<small>` tags as annotations, and produces CHAM book directories with both primary text and commentary layers.

## CLI

Installed as `cham-epub`. Converts ePub files to CHAM book directories:

```
cham-epub <epub-path> [output-dir] [options]
```

Supports auto-derivation of id/title from filenames matching the `標題_(四庫全書本).epub` pattern.

## Dependencies

- `fflate` — used only by the ePub converter for ZIP extraction
- Dev: `typescript`, `vitest`, `@types/node`

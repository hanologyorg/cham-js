// ─── Pipeline Namespace Shim ───────────────────────────────────
// This file is the canonical entry point for the pipeline submodules.
// Internal and external code should import from here (or from the
// package root), not from individual files under pipeline/. This is
// the TypeScript equivalent of Ruby's `autoload` — definitions
// collected in the immediate parent namespace's file.
//
// Implementation lives in pipeline/*.ts; this shim is the public face.

// range-builder.ts
export { entryToRange } from './pipeline/range-builder.js'

// annotation-builder.ts
export {
  mapKind, buildAnnotations, buildAnnotationsFromLayer,
  buildPartAnnotations, getHeadword, buildAnnotationsText,
} from './pipeline/annotation-builder.js'

// verse-grouper.ts
export { groupBlocksIntoVerses, remapAnnotationVerses } from './pipeline/verse-grouper.js'

// layer-builder.ts
export { parseCommentaryLayers, buildAnnotationLayers } from './pipeline/layer-builder.js'

// prose-parser.ts
export { cleanHardWraps, splitMdFrontmatter, parseProseSections } from './pipeline/prose-parser.js'

// part-builder.ts
export { buildPartOutput } from './pipeline/part-builder.js'

// piece-builder.ts
export { buildPieceFromCham } from './pipeline/piece-builder.js'

// book-builder.ts
export { BookBuilder, buildBookMeta, buildBookData } from './pipeline/book-builder.js'

// library-builder.ts
export { LibraryBuilder } from './pipeline/library-builder.js'

// library-index-builder.ts
export {
  detectScale, buildCrossRefs, buildLibraryIndex,
} from './pipeline/library-index-builder.js'

// frontend-jsonld.ts
export {
  buildAuthorsJson, buildDynastiesJson,
} from './pipeline/frontend-jsonld.js'
export type { AuthorJsonLd, DynastyJsonLd } from './pipeline/frontend-jsonld.js'

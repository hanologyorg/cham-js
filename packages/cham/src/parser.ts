// ─── Parser Namespace Shim ─────────────────────────────────────
// This file is the canonical entry point for the parser submodules.
// Internal and external code should import from here (or from the
// package root), not from individual files under parser/. This is the
// TypeScript equivalent of Ruby's `autoload` — definitions collected
// in the immediate parent namespace's file.
//
// Implementation lives in parser/*.ts; this shim is the public face.

// ChamParseError, splitFrontmatter, buildMeta
export { ChamParseError, splitFrontmatter, buildMeta } from './parser/frontmatter-parser.js'

// parseMarkers, parseSectionHeader, splitBodyAndAnnotations, buildTextBlocksAndMarkers
export {
  parseMarkers, parseSectionHeader,
  splitBodyAndAnnotations, buildTextBlocksAndMarkers,
} from './parser/text-parser.js'

// findMatchingBracket, parseBracketValue, parseAnnotationEntry, parseAnnotationSections
export {
  findMatchingBracket, parseBracketValue,
  parseAnnotationEntry, parseAnnotationSections,
} from './parser/annotation-parser.js'

// ChamParser, parse
export { ChamParser, parse } from './parser/cham-parser.js'

// Target parser (already in parser/)
export { parseTarget } from './parser/target-parser.js'
export type { TargetParseResult } from './parser/target-parser.js'

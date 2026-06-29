// ─── Serializer Namespace Shim ─────────────────────────────────
// This file is the canonical entry point for the serializer submodules.
// Internal and external code should import from here (or from the
// package root), not from individual files under serializer/. This is
// the TypeScript equivalent of Ruby's `autoload` — definitions
// collected in the immediate parent namespace's file.
//
// Implementation lives in serializer/*.ts; this shim is the public face.

// serializeValue, serializeFrontmatter, serializePrimaryMeta, etc.
export {
  serializeValue, serializeFrontmatter,
  serializePrimaryMeta, serializeSecondaryMeta, serializePartMeta,
} from './serializer/frontmatter-serializer.js'

// insertMarkers, serializeTextBlocks
export { insertMarkers, serializeTextBlocks } from './serializer/text-serializer.js'

// sortEntriesForOutput, serializeParams, serializeBracket,
// serializeEntry, serializeSection
export {
  sortEntriesForOutput, serializeParams, serializeBracket,
  serializeEntry, serializeSection,
} from './serializer/annotation-serializer.js'

// ChamSerializer, serialize
export { ChamSerializer, serialize } from './serializer/cham-serializer.js'

// Target serializer (already in serializer/)
export { serializeTarget } from './serializer/target-serializer.js'

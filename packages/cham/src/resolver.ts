// ─── Resolver Namespace Shim ───────────────────────────────────
// This file is the canonical entry point for the resolver submodules.
// Internal and external code should import from here (or from the
// package root), not from individual files under resolver/. This is
// the TypeScript equivalent of Ruby's `autoload` — definitions
// collected in the immediate parent namespace's file.
//
// Implementation lives in resolver/*.ts; this shim is the public face.

// resolver/text-index.ts
export {
  TextIndex, TextQuoteNotFoundError, TextQuoteAmbiguousError,
} from './resolver/text-index.js'
export type { TextIndexEntry } from './resolver/text-index.js'

// resolver/target-resolver.ts
export { TargetResolver, TargetResolutionError } from './resolver/target-resolver.js'
export type { ResolvedTarget, TargetResolutionReason } from './resolver/target-resolver.js'

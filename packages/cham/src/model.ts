// ─── Model Namespace Shim ──────────────────────────────────────
// This file is the canonical entry point for the model submodules.
// Internal and external code should import from here (or from the
// package root), not from individual files under model/. This is the
// TypeScript equivalent of Ruby's `autoload` — definitions collected
// in the immediate parent namespace's file.
//
// Implementation lives in model/*.ts; this shim is the public face.

// model/target.ts
export {
  targetCategory, requiresResolution, targetSortKey, describeTarget,
} from './model/target.js'
export type { TargetCategory } from './model/target.js'

// model/annotation-kind.ts
export { AnnotationKindRegistry } from './model/annotation-kind.js'
export type { AnnotationKindSpec } from './model/annotation-kind.js'

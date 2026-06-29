// ─── Types Namespace Shim ──────────────────────────────────────
// This file is the canonical entry point for the type submodules.
// Internal and external code should import from here (or from the
// package root), not from individual files under types/. This is the
// TypeScript equivalent of Ruby's `autoload` — definitions collected
// in the immediate parent namespace's file.
//
// Implementation lives in types/*.ts; this shim is the public face.

export * from './types/core.js'
export * from './types/book.js'
export * from './types/output.js'
export * from './types/registry.js'
export * from './types/validation.js'
export * from './types/epub.js'

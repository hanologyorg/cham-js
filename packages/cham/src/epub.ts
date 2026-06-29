// ─── ePub Namespace Shim ──────────────────────────────────────
// This file is the canonical entry point for the epub submodules.
// Internal and external code should import from here (or from the
// package root), not from individual files under epub/. This is the
// TypeScript equivalent of Ruby's `autoload` — definitions collected
// in the immediate parent namespace's file.
//
// Implementation lives in epub/*.ts; this shim is the public face.

export { EpubConverter } from './epub/epub-converter.js'
export type { EpubConvertOptions } from './epub/epub-converter.js'

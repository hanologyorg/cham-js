// ─── Rule Helpers ──────────────────────────────────────────────
// Shared utilities for validation rule implementations.

import type {
  ChamDocument, ValidationIssue, PrimaryMeta, SecondaryMeta,
} from '../types.js'

/**
 * Abstract base class providing issue-construction helpers.
 *
 * Concrete rules extend this class to get convenient `error()`, `warning()`,
 * and `info()` methods. The issue file path is taken from the context.
 */
export abstract class BaseRule {
  protected error(ctx: { filePath: string }, line: number | undefined, message: string): ValidationIssue {
    return { severity: 'error', file: ctx.filePath, line, message }
  }
  protected warning(ctx: { filePath: string }, line: number | undefined, message: string): ValidationIssue {
    return { severity: 'warning', file: ctx.filePath, line, message }
  }
  protected info(ctx: { filePath: string }, line: number | undefined, message: string): ValidationIssue {
    return { severity: 'info', file: ctx.filePath, line, message }
  }
}

/** Type guard: is the document primary meta? */
export function isPrimary(doc: ChamDocument): doc is ChamDocument & { meta: PrimaryMeta } {
  return doc.meta.type === 'primary'
}

/** Type guard: is the document secondary meta? */
export function isSecondary(doc: ChamDocument): doc is ChamDocument & { meta: SecondaryMeta } {
  return doc.meta.type === 'secondary'
}

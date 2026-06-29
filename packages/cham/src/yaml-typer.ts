// ─── YAML Boundary Type Helpers ────────────────────────────────
// untrusted YAML → typed records.
//
// The YAML parser returns `Record<string, unknown>`. These helpers
// provide type-safe field access with runtime guards, so malformed
// YAML produces a clear `undefined` instead of silently propagating
// the wrong type through the typed model.
//
// Use at every system boundary: `src/registry.ts` (registry loaders),
// `src/parser/frontmatter-parser.ts` (CHAM frontmatter), and any
// script that loads YAML configs.

/**
 * Narrows `unknown` to a string-keyed record, or returns undefined if
 * the value is not a non-array object.
 */
export function asRecord(raw: unknown): Record<string, unknown> | undefined {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return undefined
  return raw as Record<string, unknown>
}

/**
 * Narrows `unknown` to an array of string-keyed records, or returns
 * undefined if the value is not an array of objects.
 */
export function asArrayOfRecords(raw: unknown): Record<string, unknown>[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const out: Record<string, unknown>[] = []
  for (const item of raw) {
    const rec = asRecord(item)
    if (!rec) return undefined
    out.push(rec)
  }
  return out
}

/** Reads `field` from `record` as a string, or undefined if absent/wrong type. */
export function pickString(record: Record<string, unknown>, field: string): string | undefined {
  const v = record[field]
  return typeof v === 'string' ? v : undefined
}

/** Reads `field` from `record` as a number, or undefined if absent/wrong type. */
export function pickNumber(record: Record<string, unknown>, field: string): number | undefined {
  const v = record[field]
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined
}

/** Reads `field` from `record` as a boolean, or undefined if absent/wrong type. */
export function pickBoolean(record: Record<string, unknown>, field: string): boolean | undefined {
  const v = record[field]
  return typeof v === 'boolean' ? v : undefined
}

/** Reads `field` from `record` as a string array, filtering non-strings. */
export function pickStringArray(record: Record<string, unknown>, field: string): string[] | undefined {
  const v = record[field]
  if (!Array.isArray(v)) return undefined
  const out: string[] = []
  for (const item of v) {
    if (typeof item === 'string') out.push(item)
  }
  return out
}

/** Reads `field` from `record` as a nested record, or undefined if absent/wrong type. */
export function pickRecord(record: Record<string, unknown>, field: string): Record<string, unknown> | undefined {
  return asRecord(record[field])
}

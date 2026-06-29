// ─── Annotation Serializer ─────────────────────────────────────
// Serializes AnnotationEntry and AnnotationSection objects back into
// CHAM markdown. Uses the kind registry for display ordering and
// the target serializer for target syntax.

import type {
  AnnotationSection, AnnotationEntry,
} from '../types.js'
import { AnnotationKindRegistry } from '../model/annotation-kind.js'
import { targetSortKey } from '../model/target.js'
import { serializeTarget } from './target-serializer.js'

// ─── Canonical Kind Ordering ───────────────────────────────────

const KIND_REGISTRY = AnnotationKindRegistry.DEFAULT

function getKindOrder(kind: string): number {
  return KIND_REGISTRY.get(kind)?.displayOrder ?? 99
}

// ─── Entry Sorting ─────────────────────────────────────────────

/**
 * Sorts annotation entries for canonical output:
 * 1. By target sort key (title first, then by position)
 * 2. By kind display order (fanqie → meaning → commentary → ...)
 */
export function sortEntriesForOutput(entries: AnnotationEntry[]): AnnotationEntry[] {
  return [...entries].sort((a, b) => {
    const ta = targetSortKey(a.target)
    const tb = targetSortKey(b.target)
    for (let i = 0; i < 3; i++) {
      if (ta[i] !== tb[i]) return ta[i] - tb[i]
    }
    return getKindOrder(a.kind) - getKindOrder(b.kind)
  })
}

// ─── Param & Bracket Serialization ─────────────────────────────

/**
 * Serializes a params record as ` key1:val1 key2:val2` (leading space).
 * Returns empty string when params is empty.
 */
export function serializeParams(params: Record<string, string>): string {
  const entries = Object.entries(params)
  return entries.length ? ' ' + entries.map(([k, v]) => `${k}:${v}`).join(' ') : ''
}

/**
 * Serializes a value (with optional headword) as `[headword][value]` or `[value]`.
 * Multi-line values use the bracket-on-own-line format.
 */
export function serializeBracket(value: string, headword?: string): string {
  const needsMultiline = value.includes('\n')
  const hw = headword ? `[${headword}]` : ''

  if (needsMultiline) {
    return `${hw}[\n${value.replace(/^\n+/, '').replace(/\n+$/, '')}\n]`
  }
  return headword ? `[${headword}][${value}]` : `[${value}]`
}

// ─── Entry & Section Serialization ─────────────────────────────

export function serializeEntry(entry: AnnotationEntry): string {
  return `${serializeTarget(entry.target)} ${entry.kind}${serializeParams(entry.params)} ${serializeBracket(entry.value, entry.headword)}`
}

export function serializeSection(section: AnnotationSection): string {
  const lines: string[] = [`## ${section.name}`]

  const m = section.meta
  if (m.contributor) lines.push(`@contributor: ${m.contributor}`)
  if (m.role) lines.push(`@role: ${m.role}`)
  if (m.dynasty) lines.push(`@dynasty: ${m.dynasty}`)
  if (m.era) lines.push(`@era: ${m.era}`)
  if (m.era_year !== undefined) lines.push(`@era_year: ${m.era_year}`)
  if (m.iso !== undefined) lines.push(`@iso: ${m.iso}`)
  if (m.nature) lines.push(`@nature: ${m.nature}`)

  for (const entry of sortEntriesForOutput(section.entries)) {
    lines.push('')
    lines.push(serializeEntry(entry))
  }

  return lines.join('\n')
}

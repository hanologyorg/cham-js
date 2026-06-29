// ─── Frontmatter Serializer ────────────────────────────────────
// Serializes ChamMeta objects back into YAML frontmatter strings.

import type {
  ChamMeta, PrimaryMeta, SecondaryMeta, PartMeta,
} from '../types.js'
import { isSecondaryMeta, isPartMeta } from '../types.js'

// ─── YAML Helpers ──────────────────────────────────────────────

/**
 * Serializes a value as a YAML scalar, quoting when necessary.
 * Strings containing YAML-special characters are single-quoted.
 */
export function serializeValue(val: unknown): string {
  if (val === null || val === undefined) return 'null'
  if (typeof val === 'boolean') return val ? 'true' : 'false'
  if (typeof val === 'number') return String(val)
  if (typeof val === 'string') {
    if (/[:#\n{}[\],&*?|>!'"%@`]/.test(val))
      return `'${val.replace(/'/g, "''")}'`
    return val
  }
  return String(val)
}

// ─── Meta Serializers ──────────────────────────────────────────

export function serializePrimaryMeta(meta: PrimaryMeta): string[] {
  const lines: string[] = [
    `id: ${serializeValue(meta.id)}`,
    `title: ${serializeValue(meta.title)}`,
  ]

  if (meta.contributors?.length) {
    lines.push('contributors:')
    for (const c of meta.contributors) {
      lines.push(`  - ref: ${serializeValue(c.ref)}`)
      lines.push(`    role: ${serializeValue(c.role)}`)
      if (c.title) lines.push(`    title: ${serializeValue(c.title)}`)
    }
  }

  if (meta.date) {
    lines.push('date:')
    if (meta.date.dynasty) lines.push(`  dynasty: ${serializeValue(meta.date.dynasty)}`)
    if (meta.date.era) lines.push(`  era: ${serializeValue(meta.date.era)}`)
    if (meta.date.eraCode) lines.push(`  eraCode: ${serializeValue(meta.date.eraCode)}`)
    if (meta.date.era_year !== undefined) lines.push(`  era_year: ${meta.date.era_year}`)
    if (meta.date.sexagenary) lines.push(`  sexagenary: ${serializeValue(meta.date.sexagenary)}`)
    if (meta.date.iso !== undefined) lines.push(`  iso: ${meta.date.iso}`)
    if (meta.date.circa) lines.push('  circa: true')
  }

  if (meta.genre) lines.push(`genre: ${serializeValue(meta.genre)}`)

  if (meta.source) {
    lines.push('source:')
    if (meta.source.text) lines.push(`  text: ${serializeValue(meta.source.text)}`)
    if (meta.source.textRef) lines.push(`  textRef: ${serializeValue(meta.source.textRef)}`)
    if (meta.source.edition) lines.push(`  edition: ${serializeValue(meta.source.edition)}`)
    if (meta.source.publisher) lines.push(`  publisher: ${serializeValue(meta.source.publisher)}`)
    if (meta.source.relation) lines.push(`  relation: ${serializeValue(meta.source.relation)}`)
    if (meta.source.range) {
      lines.push('  range:')
      const r = meta.source.range as Record<string, unknown>
      for (const [k, v] of Object.entries(r)) {
        if (v !== undefined) lines.push(`    ${k}: ${serializeValue(v)}`)
      }
    }
  }

  if (meta.hierarchy?.length) {
    lines.push('hierarchy:')
    for (const h of meta.hierarchy) {
      const fields = [`level: ${serializeValue(h.level)}`, `index: ${h.index}`]
      if (h.label) fields.push(`label: ${serializeValue(h.label)}`)
      if (h.parent !== undefined) fields.push(`parent: ${serializeValue(h.parent)}`)
      lines.push('  - ' + fields[0])
      for (let i = 1; i < fields.length; i++) lines.push('    ' + fields[i])
    }
  }

  return lines
}

export function serializeSecondaryMeta(meta: SecondaryMeta): string[] {
  const lines: string[] = [`base: ${serializeValue(meta.base)}`]
  if (meta.contributor) lines.push(`contributor: ${serializeValue(meta.contributor)}`)
  if (meta.role) lines.push(`role: ${serializeValue(meta.role)}`)
  if (meta.dynasty) lines.push(`dynasty: ${serializeValue(meta.dynasty)}`)
  if (meta.nature) lines.push(`nature: ${serializeValue(meta.nature)}`)
  return lines
}

export function serializePartMeta(meta: PartMeta): string[] {
  const lines: string[] = [`part: ${meta.part}`]
  if (meta.group) lines.push(`group: ${serializeValue(meta.group)}`)
  if (meta.title) lines.push(`title: ${serializeValue(meta.title)}`)
  if (meta.source) {
    lines.push('source:')
    if (meta.source.textRef) lines.push(`  textRef: ${serializeValue(meta.source.textRef)}`)
    if (meta.source.relation) lines.push(`  relation: ${serializeValue(meta.source.relation)}`)
    if (meta.source.range) {
      lines.push('  range:')
      const r = meta.source.range as Record<string, unknown>
      for (const [k, v] of Object.entries(r)) {
        lines.push(`    ${k}: ${serializeValue(v)}`)
      }
    }
  }
  return lines
}

export function serializeFrontmatter(meta: ChamMeta): string {
  const lines = isSecondaryMeta(meta)
    ? serializeSecondaryMeta(meta)
    : isPartMeta(meta)
      ? serializePartMeta(meta as PartMeta)
      : serializePrimaryMeta(meta as PrimaryMeta)
  return `---\n${lines.join('\n')}\n---`
}

// ─── Annotation Parser ─────────────────────────────────────────
// Parses annotation sections (## Header + entries) into AnnotationSection[].
// Each entry is parsed into an AnnotationEntry with a typed target.

import type {
  AnnotationSection, AnnotationEntry, SectionMeta,
} from '../types.js'
import { parseTarget } from './target-parser.js'

// ─── Bracket Value Parsing ─────────────────────────────────────

/**
 * Finds the matching closing `]` for an opening `[` at position `start`.
 * Handles multi-line values where `]` appears on its own line.
 */
export function findMatchingBracket(text: string, start: number): number {
  if (text[start] !== '[') return -1
  const afterOpen = text.slice(start + 1)

  const firstClose = afterOpen.indexOf(']')
  const firstNewline = afterOpen.indexOf('\n')

  if (firstClose !== -1 && (firstNewline === -1 || firstClose < firstNewline))
    return start + 1 + firstClose

  const lines = afterOpen.split('\n')
  let offset = 0
  for (const line of lines) {
    if (line.trim() === ']') return start + 1 + offset + line.indexOf(']')
    offset += line.length + 1
  }

  const lastClose = afterOpen.lastIndexOf(']')
  return lastClose !== -1 ? start + 1 + lastClose : -1
}

/**
 * Parses a `[value]` or `[headword][value]` bracket expression.
 * Returns the headword (if any), value, and number of characters consumed.
 */
export function parseBracketValue(text: string): {
  headword?: string
  value: string
  consumed: number
} {
  text = text.trimStart()
  if (!text.startsWith('[')) return { value: '', consumed: 0 }

  const singleEnd = findMatchingBracket(text, 0)
  if (singleEnd === -1) return { value: '', consumed: 0 }

  const first = text.slice(1, singleEnd)
  const afterFirst = text.slice(singleEnd + 1).trimStart()

  if (afterFirst.startsWith('[')) {
    const secondEnd = findMatchingBracket(afterFirst, 0)
    if (secondEnd === -1) return { headword: first, value: '', consumed: singleEnd + 1 }
    return {
      headword: first,
      value: afterFirst.slice(1, secondEnd),
      consumed: singleEnd + 1 + secondEnd + 1,
    }
  }

  return { value: first, consumed: singleEnd + 1 }
}

// ─── Annotation Entry Parsing ──────────────────────────────────

/**
 * Parses a single annotation entry line into an AnnotationEntry.
 * Returns null if the line doesn't start with a valid target syntax.
 *
 * Format: `{target} kind [params] [headword] [value]`
 * where `{target}` is parsed by {@link parseTarget}.
 */
export function parseAnnotationEntry(line: string): AnnotationEntry | null {
  line = line.trim()
  if (!line) return null

  const targetResult = parseTarget(line)
  if (!targetResult) return null
  let rest = line.slice(targetResult.consumed).trimStart()

  const kindMatch = rest.match(/^([\w-]+)\s*/)
  if (!kindMatch) return null
  const kind = kindMatch[1]
  rest = rest.slice(kindMatch[0].length)

  const params = parseParams(rest)
  rest = params.rest
  const { headword, value } = parseBracketValue(rest)
  return { target: targetResult.target, kind, params: params.params, headword, value }
}

/**
 * Parses `key:value key:value` param pairs until exhausted.
 * Returns the parsed params and the unconsumed rest of the string.
 */
function parseParams(text: string): { params: Record<string, string>; rest: string } {
  const params: Record<string, string> = {}
  while (text.length > 0) {
    const paramMatch = text.match(/^(\w+):(\S+)\s*/)
    if (!paramMatch) break
    params[paramMatch[1]] = paramMatch[2]
    text = text.slice(paramMatch[0].length)
  }
  return { params, rest: text }
}

// ─── Annotation Section Parsing ────────────────────────────────

/**
 * Parses the annotation section of a document body into AnnotationSections.
 *
 * Each section begins with `## SectionName`, optionally followed by
 * `@key: value` meta lines, then annotation entries (possibly multi-line).
 */
export function parseAnnotationSections(body: string): AnnotationSection[] {
  const sections: AnnotationSection[] = []
  const lines = body.split('\n')
  let i = 0

  while (i < lines.length && !lines[i].startsWith('## ')) i++

  while (i < lines.length) {
    if (!lines[i].startsWith('## ')) { i++; continue }

    const name = lines[i].slice(3).trim()
    i++

    const meta = parseSectionMeta(lines, i)
    i = meta.consumed

    const entries = parseSectionEntries(lines, i)
    i = entries.consumed

    sections.push({ name, meta: meta.meta, entries: entries.entries })
  }

  return sections
}

/**
 * Parses consecutive `@key: value` meta lines following a section header.
 *
 * Each known SectionMeta field is parsed with its correct type:
 * `era_year` and `iso` are numbers; everything else is a string.
 * Unknown keys are dropped (no silent propagation).
 */
function parseSectionMeta(
  lines: string[],
  startIdx: number,
): { meta: SectionMeta; consumed: number } {
  const raw: Record<string, string> = {}
  let i = startIdx
  while (i < lines.length && lines[i].startsWith('@')) {
    const ci = lines[i].indexOf(':')
    if (ci !== -1) {
      raw[lines[i].slice(1, ci).trim()] = lines[i].slice(ci + 1).trim()
    }
    i++
  }
  return { meta: buildSectionMeta(raw), consumed: i }
}

/** Coerces a raw key-value map to a typed SectionMeta. */
function buildSectionMeta(raw: Record<string, string>): SectionMeta {
  const meta: SectionMeta = {}
  if (raw.contributor) meta.contributor = raw.contributor
  if (raw.role) meta.role = raw.role
  if (raw.dynasty) meta.dynasty = raw.dynasty
  if (raw.era) meta.era = raw.era
  if (raw.eraCode) meta.eraCode = raw.eraCode
  if (raw.nature) meta.nature = raw.nature
  const eraYear = parseInt(raw.era_year ?? '', 10)
  if (Number.isFinite(eraYear)) meta.era_year = eraYear
  const iso = parseInt(raw.iso ?? '', 10)
  if (Number.isFinite(iso)) meta.iso = iso
  return meta
}

/**
 * Parses annotation entries within a section until the next `##` header.
 * Handles multi-line entries (where opening `[` count exceeds closing `]`).
 */
function parseSectionEntries(
  lines: string[],
  startIdx: number,
): { entries: AnnotationEntry[]; consumed: number } {
  const entries: AnnotationEntry[] = []
  let pendingMultiline = ''
  let inMultiline = false
  let i = startIdx

  while (i < lines.length) {
    const entryLine = lines[i]
    if (entryLine.startsWith('## ')) break

    if (inMultiline) {
      if (entryLine.trim() === ']') {
        pendingMultiline += '\n]'
        const entry = parseAnnotationEntry(pendingMultiline)
        if (entry) entries.push(entry)
        inMultiline = false
        pendingMultiline = ''
        i++
        continue
      }
      pendingMultiline += '\n' + entryLine
      i++
      continue
    }

    const trimmed = entryLine.trim()
    if (!trimmed) { i++; continue }

    const openBrackets = (trimmed.match(/\[/g) || []).length
    const closeBrackets = (trimmed.match(/\]/g) || []).length
    if (openBrackets > closeBrackets) {
      pendingMultiline = trimmed
      inMultiline = true
      i++
      continue
    }

    const entry = parseAnnotationEntry(trimmed)
    if (entry) entries.push(entry)
    i++
  }

  return { entries, consumed: i }
}

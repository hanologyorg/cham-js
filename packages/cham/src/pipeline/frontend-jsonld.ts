// ─── Frontend JSON-LD ─────────────────────────────────────────
// Schema.org-compatible transforms of author and dynasty data for
// the frontend. Distinct concern from index-shape building — these
// functions define how CHAM data is rendered as linked-data records,
// and are the single place to evolve when the Schema.org vocabulary
// or frontend expectations change.

import type { AuthorRecord, OutputPiece } from '../types.js'

/**
 * JSON-LD Person record for an author. Returned by {@link buildAuthorsJson}.
 */
export interface AuthorJsonLd {
  readonly '@id': string
  readonly '@type': 'Person'
  readonly name: string
  readonly era: string
  readonly bio: string
  readonly workCount: number
}

/**
 * JSON-LD HistoricalPeriod record for a dynasty. Returned by {@link buildDynastiesJson}.
 */
export interface DynastyJsonLd {
  readonly '@id': string
  readonly '@type': 'HistoricalPeriod'
  readonly name: string
  readonly authors: readonly string[]
  readonly workCount: number
}

/**
 * Builds JSON-LD author records for the library index.
 * Includes work counts aggregated across pieces and contributors.
 */
export function buildAuthorsJson(
  authors: Readonly<Record<string, AuthorRecord>>,
  allPieces: readonly OutputPiece[],
): AuthorJsonLd[] {
  const pieceCounts = new Map<string, number>()
  for (const p of allPieces) {
    pieceCounts.set(p.authorId, (pieceCounts.get(p.authorId) || 0) + 1)
    if (p.contributors) {
      for (const c of p.contributors) {
        if (c.id !== p.authorId) {
          pieceCounts.set(c.id, (pieceCounts.get(c.id) || 0) + 1)
        }
      }
    }
  }

  return Object.entries(authors).map(([id, data]) => ({
    '@id': `author:${encodeURIComponent(data.name)}`,
    '@type': 'Person' as const,
    name: data.name,
    era: data.era || data.dynasty || '',
    bio: data.bio || '',
    workCount: pieceCounts.get(id) || 0,
  }))
}

/**
 * Builds JSON-LD dynasty records aggregated from pieces.
 */
export function buildDynastiesJson(
  allPieces: readonly OutputPiece[],
): Record<string, DynastyJsonLd> {
  const map = new Map<string, { authors: Set<string>; count: number }>()

  for (const piece of allPieces) {
    const d = piece.era
    if (!d) continue
    if (!map.has(d)) map.set(d, { authors: new Set(), count: 0 })
    const entry = map.get(d)!
    entry.authors.add(piece.author)
    entry.count++
  }

  const result: Record<string, DynastyJsonLd> = {}
  for (const [name, data] of map) {
    result[name] = {
      '@id': `dynasty:${encodeURIComponent(name)}`,
      '@type': 'HistoricalPeriod' as const,
      name,
      authors: [...data.authors],
      workCount: data.count,
    }
  }
  return result
}
